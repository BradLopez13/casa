import { type MutationKey, type MutationOptions, type QueryClient } from '@tanstack/react-query';
import { offlineFirstQueryOptions, retryOnNetwork } from '@/data/query/retry';
import type { AppError } from '@/data/supabase/errors';
import { applyAdd, applyBought, applyQuantity, type ShoppingItem } from '@/domain/shopping/list';
import { normalizeItemName, trimItemText } from '@/domain/shopping/normalize';
import { t } from '@/i18n';
import { addShoppingItem, setItemBought, updateShoppingItem } from './api';
import { shoppingErrorMessage } from './errors';

/** Shopping mutations share one scope, so a queue built offline reaches the server in order. */
export const SHOPPING_SCOPE = { id: 'shopping' };
export const addKey = ['shopping', 'add'];
export const boughtKey = ['shopping', 'bought'];
export const quantityKey = ['shopping', 'quantity'];

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

export type QuantityVars = {
  id: string;
  householdId: string;
  name: string;
  quantity: string | null;
};
export type QuantityContext = { previous: ShoppingItem | undefined };

/**
 * Whether a shopping mutation still on its way marks its row as unsent. A quantity save is a
 * short online request: it only counts once it waits for the connection, so the icon does not
 * jump in beside the stepper on every save.
 */
export function countsAsUnsent(mutationKey: MutationKey | undefined, isPaused: boolean): boolean {
  return mutationKey?.[1] === quantityKey[1] ? isPaused : true;
}

/**
 * The queued shopping mutations, add, bought and the quantity: theirs are the only shopping
 * mutation functions registered (as defaults) before the cache is restored, so only they survive
 * a restart (`features/offline/persistence.ts`). A quantity is an absolute value, so sending it
 * again is safe (bloque 11: offline it was queued but lost on a restart).
 */
export function isQueuedShoppingMutation(mutationKey: MutationKey | undefined): boolean {
  return (
    mutationKey?.[0] === 'shopping' &&
    (mutationKey[1] === addKey[1] ||
      mutationKey[1] === boughtKey[1] ||
      mutationKey[1] === quantityKey[1])
  );
}

/**
 * Resumes the restored queue, in order (the scope serializes it). `resumePausedMutations` alone
 * would skip the mutations that were in flight when the app closed: they restore unpaused.
 *
 * A restored shopping mutation this build no longer queues (an older build's category change)
 * has no function to run and nothing would ever settle it: left in the scope it would block
 * every later add, bought and clear. It is dropped.
 */
export function resumeShoppingQueue(queryClient: QueryClient): Promise<unknown> {
  const cache = queryClient.getMutationCache();
  const stale = cache.findAll({
    predicate: (m) =>
      m.options.mutationKey?.[0] === 'shopping' && !isQueuedShoppingMutation(m.options.mutationKey),
  });
  for (const mutation of stale) cache.remove(mutation);
  const queued = cache.findAll({
    status: 'pending',
    predicate: (m) => isQueuedShoppingMutation(m.options.mutationKey),
  });
  return Promise.all(queued.map((m) => m.continue().catch(() => undefined)));
}

const listKey = (householdId: string) => ['shopping', householdId];

/** The row as the person added it, until the server's comes back with the refetch. */
export function draftShoppingItem(
  { id, name, quantity, userId }: AddVars,
  at = new Date(),
): ShoppingItem {
  return {
    id,
    name: trimItemText(name),
    normalizedName: normalizeItemName(name),
    quantity,
    createdAt: at.toISOString(),
    createdBy: userId,
    boughtAt: null,
    boughtBy: null,
  };
}

/**
 * The adds that resolved to an item already on the list, by the id they were queued with: a
 * bought queued behind one must reach that item, even after a restart. It lives in the query
 * cache, so the persister saves it with the queue, in the same write.
 */
export const resolvedKey = (householdId: string) => ['shopping-resolved', householdId];
type Resolved = Readonly<Record<string, string>>;

/** Several shopping mutations can be in flight: refetch once, after the last one settles. */
export async function invalidateShoppingWhenIdle(queryClient: QueryClient): Promise<void> {
  if (queryClient.isMutating({ mutationKey: ['shopping'] }) === 1) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['shopping'] }),
      queryClient.invalidateQueries({ queryKey: ['shopping-history'] }),
    ]);
  }
}

/** The shopping list and its history load offline first (`offlineFirstQueryOptions`). */
export const shoppingQueryOptions = offlineFirstQueryOptions;

export { NETWORK_RETRIES } from '@/data/query/retry';

export function buildShoppingMutationDefaults(
  queryClient: QueryClient,
  notify: (message: string) => void,
): {
  add: MutationOptions<string, AppError, AddVars, AddContext>;
  bought: MutationOptions<void, AppError, BoughtVars, BoughtContext>;
  quantity: MutationOptions<void, AppError, QuantityVars, QuantityContext>;
} {
  // Nothing observes the resolved ids: without this they would be collected after five minutes,
  // while a bought waiting for the connection may still need them.
  queryClient.setQueryDefaults(['shopping-resolved'], { gcTime: Infinity });
  const resolve = (householdId: string, id: string) =>
    queryClient.getQueryData<Resolved>(resolvedKey(householdId))?.[id] ?? id;
  // Keeps the resolutions a pending bought or quantity change still needs, plus the new one.
  const remember = (householdId: string, id: string, resolvedId: string) => {
    const needed = new Set(
      queryClient
        .getMutationCache()
        .findAll({
          status: 'pending',
          predicate: (m) => {
            const kind = m.options.mutationKey?.[1];
            return kind === boughtKey[1] || kind === quantityKey[1];
          },
        })
        .map((m) => (m.state.variables as { id?: string } | undefined)?.id),
    );
    queryClient.setQueryData<Resolved>(resolvedKey(householdId), (current) => ({
      ...Object.fromEntries(Object.entries(current ?? {}).filter(([from]) => needed.has(from))),
      [id]: resolvedId,
    }));
  };
  const syncFailed = (name: string) => notify(t('shopping.syncFailed', { name }));

  const add: MutationOptions<string, AppError, AddVars, AddContext> = {
    mutationKey: addKey,
    scope: SHOPPING_SCOPE,
    // Offline it waits for the connection, unlike the rest of the app.
    networkMode: 'online',
    retry: retryOnNetwork,
    mutationFn: ({ id, householdId, name, quantity }) =>
      addShoppingItem(id, householdId, name, quantity),
    onMutate: async (vars) => {
      const { id, householdId } = vars;
      const key = listKey(householdId);
      await queryClient.cancelQueries({ queryKey: key });
      const item = draftShoppingItem(vars);
      queryClient.setQueryData<ShoppingItem[]>(key, (current) =>
        current ? applyAdd(current, item) : current,
      );
      const added = queryClient.getQueryData<ShoppingItem[]>(key)?.some((i) => i.id === id);
      return { item, added: added ?? false };
    },
    onSuccess: (resolvedId, { id, householdId }, context) => {
      if (resolvedId === id) return;
      remember(householdId, id, resolvedId);
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
    mutationFn: ({ id, householdId, bought: value }) =>
      setItemBought(resolve(householdId, id), value),
    onMutate: async ({ id, householdId, bought: value, userId }) => {
      const key = listKey(householdId);
      await queryClient.cancelQueries({ queryKey: key });
      const target = resolve(householdId, id);
      const previous = queryClient.getQueryData<ShoppingItem[]>(key)?.find((i) => i.id === target);
      queryClient.setQueryData<ShoppingItem[]>(key, (current) =>
        current ? applyBought(current, target, value, userId, new Date().toISOString()) : current,
      );
      return { previous };
    },
    // Roll back only this item's bought state: other changes in flight keep theirs.
    onError: (_error, { id, householdId }, context) => {
      const key = listKey(householdId);
      const target = resolve(householdId, id);
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

  // The row's stepper: each tap shows at once (optimistic), the save goes after a pause. Without a
  // connection it waits in the queue like an add or a bought, and is kept on the device with it
  // (bloque 11: «sin red, lo cotidiano se encola»).
  const quantity: MutationOptions<void, AppError, QuantityVars, QuantityContext> = {
    mutationKey: quantityKey,
    scope: SHOPPING_SCOPE,
    networkMode: 'online',
    retry: retryOnNetwork,
    mutationFn: async ({ id, householdId, name, quantity: value }) => {
      const target = resolve(householdId, id);
      // Bought (here or by someone else) or gone before its turn: nothing left to change.
      const item = queryClient
        .getQueryData<ShoppingItem[]>(listKey(householdId))
        ?.find((i) => i.id === target);
      if (!item || item.boughtAt !== null) return;
      await updateShoppingItem(target, name, value);
    },
    onMutate: async ({ id, householdId, quantity: value }) => {
      const key = listKey(householdId);
      const target = resolve(householdId, id);
      const previous = queryClient.getQueryData<ShoppingItem[]>(key)?.find((i) => i.id === target);
      // Before the await, so a bought queued right after cannot get in first and hide it.
      queryClient.setQueryData<ShoppingItem[]>(key, (current) =>
        current ? applyQuantity(current, target, value) : current,
      );
      await queryClient.cancelQueries({ queryKey: key });
      return { previous };
    },
    // Roll back only this item's quantity: other changes in flight keep theirs.
    onError: (error, { id, householdId }, context) => {
      const previous = context?.previous;
      if (previous) {
        queryClient.setQueryData<ShoppingItem[]>(listKey(householdId), (current) =>
          current ? applyQuantity(current, resolve(householdId, id), previous.quantity) : current,
        );
      }
      notify(shoppingErrorMessage(error));
    },
    onSettled: () => invalidateShoppingWhenIdle(queryClient),
  };

  return { add, bought, quantity };
}
