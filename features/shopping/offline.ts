import type { MutationKey, MutationOptions, QueryClient, QueryKey } from '@tanstack/react-query';
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

const PERSISTED_QUERIES: ReadonlySet<unknown> = new Set(['shopping', 'shopping-history']);

/** Only the shopping list and its history are kept on the device. */
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

// A request that never reached the server keeps the mutation queued (retries pause while
// offline) instead of dropping it; any other error is final.
const retryOnNetwork = (_failureCount: number, error: AppError) =>
  toAppError(error).code === 'NETWORK';

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
      queryClient.setQueryData<ShoppingItem[]>(listKey(householdId), (current) =>
        current ? applyAdd(current, context.item, resolvedId) : current,
      );
    },
    onError: (error, { id, householdId, name }, context) => {
      if (toAppError(error).code === 'NETWORK') return;
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
    onError: (error, { id, householdId }, context) => {
      if (toAppError(error).code === 'NETWORK') return;
      const previous = context?.previous;
      if (previous) {
        const target = resolve(id);
        queryClient.setQueryData<ShoppingItem[]>(listKey(householdId), (current) =>
          current?.map((i) =>
            i.id === target
              ? { ...i, boughtAt: previous.boughtAt, boughtBy: previous.boughtBy }
              : i,
          ),
        );
      }
      syncFailed(previous?.name ?? '');
    },
    onSettled: () => invalidateShoppingWhenIdle(queryClient),
  };

  return { add, bought };
}
