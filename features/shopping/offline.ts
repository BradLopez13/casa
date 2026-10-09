import {
  onlineManager,
  type DehydrateOptions,
  type MutationKey,
  type MutationOptions,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { toAppError, type AppError } from '@/data/supabase/errors';
import { applyAdd, applyBought, type ShoppingItem } from '@/domain/shopping/list';
import { normalizeItemName, trimItemText } from '@/domain/shopping/normalize';
import { t } from '@/i18n';
import { addShoppingItem, setItemBought } from './api';

/** Shopping mutations share one scope, so a queue built offline reaches the server in order. */
export const SHOPPING_SCOPE = { id: 'shopping' };
export const addKey = ['shopping', 'add'];
export const boughtKey = ['shopping', 'bought'];

export type AddVars = {
  id: string;
  householdId: string;
  name: string;
  quantity: string | null;
  userId: string;
};
export type AddContext = { item: ShoppingItem; added: boolean };

export type BoughtVars = { id: string; householdId: string; bought: boolean; userId: string };
export type BoughtContext = { previous: ShoppingItem | undefined };

const PERSISTED_QUERIES: ReadonlySet<unknown> = new Set([
  'shopping',
  'shopping-history',
  'membership',
  'members',
]);

/**
 * Kept on the device: the shopping list and its history, plus the membership (an offline cold
 * start gets past the route guard) and the members (the buyers' magnets).
 */
export function shouldPersistQuery(queryKey: QueryKey): boolean {
  return PERSISTED_QUERIES.has(queryKey[0]);
}

/**
 * Only the queued add and bought survive a restart: theirs are the only mutation functions
 * registered (as defaults) before the cache is restored.
 */
export function shouldPersistMutation(mutationKey: MutationKey | undefined): boolean {
  return (
    mutationKey?.[0] === 'shopping' &&
    (mutationKey[1] === addKey[1] || mutationKey[1] === boughtKey[1])
  );
}

/**
 * What goes on the device: settled persisted queries, and every queued add or bought still
 * pending. That includes one in flight or waiting to retry when the app closes; resending it is
 * safe, because the add is idempotent by id and the bought sets an absolute value.
 */
export const persistDehydrateOptions: DehydrateOptions = {
  shouldDehydrateQuery: (query) =>
    shouldPersistQuery(query.queryKey) && query.state.status === 'success',
  shouldDehydrateMutation: (mutation) =>
    mutation.state.status === 'pending' && shouldPersistMutation(mutation.options.mutationKey),
};

/**
 * Resumes the restored queue, in order (the scope serializes it). `resumePausedMutations` alone
 * would skip the mutations that were in flight when the app closed: they restore unpaused.
 */
export function resumeShoppingQueue(queryClient: QueryClient): Promise<unknown> {
  const queued = queryClient
    .getMutationCache()
    .findAll({ status: 'pending', predicate: (m) => shouldPersistMutation(m.options.mutationKey) });
  return Promise.all(queued.map((m) => m.continue().catch(() => undefined)));
}

/** A persisted cache from another app version or another user is discarded. */
export function persistBuster(appVersion: string, userId: string | null): string {
  return `${appVersion}:${userId ?? 'anon'}`;
}

const listKey = (householdId: string) => ['shopping', householdId];

/** Several shopping mutations can be in flight: refetch once, after the last one settles. */
export async function invalidateShoppingWhenIdle(queryClient: QueryClient): Promise<void> {
  if (queryClient.isMutating({ mutationKey: ['shopping'] }) === 1) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['shopping'] }),
      queryClient.invalidateQueries({ queryKey: ['shopping-history'] }),
    ]);
  }
}

/**
 * The shopping list and its history load offline first: a load is tried even while offline
 * (the connection state can lag), and an offline failure is final at once instead of waiting
 * for the connection. The cached list stays on screen with the offline band; with nothing
 * cached the screen shows its error and its retry. Back online, the reconnect refetches it.
 * The app's default ('always') would retry offline too; 'online' would leave a list never
 * loaded spinning until the connection is back.
 */
export const shoppingQueryOptions = {
  networkMode: 'offlineFirst',
  retry: (failureCount: number) => failureCount < 1 && onlineManager.isOnline(),
} as const;

export const NETWORK_RETRIES = 10;

// A request that never reached the server is retried (retries pause while offline), with the
// default backoff capped at 30 s. The cap keeps one stuck item from holding the scope, and with
// it edits, deletes and clears, forever. Any other error is final.
const retryOnNetwork = (failureCount: number, error: AppError) =>
  failureCount < NETWORK_RETRIES && toAppError(error).code === 'NETWORK';

export function buildShoppingMutationDefaults(
  queryClient: QueryClient,
  notify: (message: string) => void,
): {
  add: MutationOptions<string, AppError, AddVars, AddContext>;
  bought: MutationOptions<void, AppError, BoughtVars, BoughtContext>;
} {
  // An add can resolve to an item that was already on the list; a bought queued behind it
  // must reach that item.
  const resolved = new Map<string, string>();
  const resolve = (id: string) => resolved.get(id) ?? id;
  const syncFailed = (name: string) => notify(t('shopping.syncFailed', { name }));

  const add: MutationOptions<string, AppError, AddVars, AddContext> = {
    mutationKey: addKey,
    scope: SHOPPING_SCOPE,
    // Offline it waits for the connection, unlike the rest of the app.
    networkMode: 'online',
    retry: retryOnNetwork,
    mutationFn: ({ id, householdId, name, quantity }) =>
      addShoppingItem(id, householdId, name, quantity),
    onMutate: async ({ id, householdId, name, quantity, userId }) => {
      const key = listKey(householdId);
      await queryClient.cancelQueries({ queryKey: key });
      const item: ShoppingItem = {
        id,
        name: trimItemText(name),
        normalizedName: normalizeItemName(name),
        quantity,
        createdAt: new Date().toISOString(),
        createdBy: userId,
        boughtAt: null,
        boughtBy: null,
      };
      queryClient.setQueryData<ShoppingItem[]>(key, (current) =>
        current ? applyAdd(current, item) : current,
      );
      const added = queryClient.getQueryData<ShoppingItem[]>(key)?.some((i) => i.id === id);
      return { item, added: added ?? false };
    },
    onSuccess: (resolvedId, { id, householdId }, context) => {
      if (resolvedId === id) return;
      resolved.set(id, resolvedId);
      // A restored add can come without its context (the app closed during onMutate): its
      // optimistic item, if it reached the list, is found by id.
      queryClient.setQueryData<ShoppingItem[]>(listKey(householdId), (current) => {
        const item = context?.item ?? current?.find((i) => i.id === id);
        return current && item ? applyAdd(current, item, resolvedId) : current;
      });
    },
    // Offline the mutation pauses instead of failing, so this is a final error.
    onError: (_error, { id, householdId, name }, context) => {
      if (context?.added) {
        queryClient.setQueryData<ShoppingItem[]>(listKey(householdId), (current) =>
          current?.filter((i) => i.id !== id),
        );
      }
      syncFailed(trimItemText(name));
    },
    onSettled: () => invalidateShoppingWhenIdle(queryClient),
  };

  const bought: MutationOptions<void, AppError, BoughtVars, BoughtContext> = {
    mutationKey: boughtKey,
    scope: SHOPPING_SCOPE,
    networkMode: 'online',
    retry: retryOnNetwork,
    mutationFn: ({ id, bought: value }) => setItemBought(resolve(id), value),
    onMutate: async ({ id, householdId, bought: value, userId }) => {
      const key = listKey(householdId);
      await queryClient.cancelQueries({ queryKey: key });
      const target = resolve(id);
      const previous = queryClient.getQueryData<ShoppingItem[]>(key)?.find((i) => i.id === target);
      queryClient.setQueryData<ShoppingItem[]>(key, (current) =>
        current ? applyBought(current, target, value, userId, new Date().toISOString()) : current,
      );
      return { previous };
    },
    // Roll back only this item's bought state: other changes in flight keep theirs.
    onError: (_error, { id, householdId }, context) => {
      const key = listKey(householdId);
      const target = resolve(id);
      const previous = context?.previous;
      if (previous) {
        queryClient.setQueryData<ShoppingItem[]>(key, (current) =>
          current?.map((i) =>
            i.id === target
              ? { ...i, boughtAt: previous.boughtAt, boughtBy: previous.boughtBy }
              : i,
          ),
        );
      }
      // An item no longer on the list has nothing to explain.
      const item = queryClient.getQueryData<ShoppingItem[]>(key)?.find((i) => i.id === target);
      if (item) syncFailed(item.name);
    },
    onSettled: () => invalidateShoppingWhenIdle(queryClient),
  };

  return { add, bought };
}
