import { type MutationKey, type MutationOptions, type QueryClient } from '@tanstack/react-query';
import { QUEUED_META, touches } from '@/data/query/queue';
import { assertQueuedBy, droppedOnSignOut } from '@/data/query/sessionUser';
import { offlineFirstQueryOptions, retryDelayOnNetwork, retryOnNetwork } from '@/data/query/retry';
import { toAppError, type AppError } from '@/data/supabase/errors';
import { applyAdd, applyBought, applyQuantity, type ShoppingItem } from '@/domain/shopping/list';
import { normalizeItemName, trimItemText } from '@/domain/shopping/normalize';
import { t } from '@/i18n';
import { addShoppingItem, setItemBought, updateShoppingItem } from './api';
import { shoppingErrorMessage } from './errors';

/**
 * The scope of the defaults, for a mutation that names no household: older builds had one queue
 * for every household, and a restored change from one is moved to its household's (`queueStore`).
 */
export const SHOPPING_SCOPE = { id: 'shopping' };

/**
 * Each household's shopping changes share one queue, so a queue built offline reaches the server
 * in order; another household's never waits behind it (bloque 13, Aud P3-1).
 */
export const shoppingScope = (householdId: string | undefined) => ({
  id: `shopping:${householdId ?? ''}`,
});
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
  /** Who changed it: the change goes as them or not at all (`assertQueuedBy`). */
  userId?: string;
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

/**
 * Several shopping mutations of a household can be in flight: refetch its list once, after its
 * last one settles; another household's queue no longer holds it back (bloque 13).
 */
export async function invalidateShoppingWhenIdle(
  queryClient: QueryClient,
  householdId?: string,
): Promise<void> {
  const busy = queryClient.isMutating({
    predicate: (m) => m.options.mutationKey?.[0] === 'shopping' && touches(m, householdId),
  });
  if (busy === 1) {
    const scoped = (kind: string) => (householdId === undefined ? [kind] : [kind, householdId]);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: scoped('shopping') }),
      queryClient.invalidateQueries({ queryKey: scoped('shopping-history') }),
    ]);
  }
}

/** The shopping list and its history load offline first (`offlineFirstQueryOptions`). */
export const shoppingQueryOptions = offlineFirstQueryOptions;

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
  // A household without its licence says so (bloque 12); anything else names what was not saved.
  const syncFailed = (name: string, error: unknown) =>
    notify(
      toAppError(error).code === 'LICENSE_REQUIRED'
        ? t('errors.LICENSE_REQUIRED')
        : t('shopping.syncFailed', { name }),
    );

  const add: MutationOptions<string, AppError, AddVars, AddContext> = {
    mutationKey: addKey,
    scope: SHOPPING_SCOPE,
    // Offline it waits for the connection, unlike the rest of the app.
    networkMode: 'online',
    retry: retryOnNetwork,
    retryDelay: retryDelayOnNetwork,
    mutationFn: async ({ id, householdId, name, quantity, userId }) => {
      assertQueuedBy(userId);
      return addShoppingItem(id, householdId, name, quantity);
    },
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
    onError: (error, { id, householdId, name }, context) => {
      if (droppedOnSignOut(error)) return;
      if (context?.added) {
        queryClient.setQueryData<ShoppingItem[]>(listKey(householdId), (current) =>
          current?.filter((i) => i.id !== id),
        );
      }
      syncFailed(trimItemText(name), error);
    },
    // Not awaited: the mutation stays pending until onSettled returns, and a refetch finished in
    // the meantime would lay a change that failed back on top of the list (bloque 12).
    onSettled: (_data, _error, { householdId }) => {
      void invalidateShoppingWhenIdle(queryClient, householdId);
    },
  };

  const bought: MutationOptions<void, AppError, BoughtVars, BoughtContext> = {
    mutationKey: boughtKey,
    scope: SHOPPING_SCOPE,
    meta: QUEUED_META,
    networkMode: 'online',
    retry: retryOnNetwork,
    retryDelay: retryDelayOnNetwork,
    mutationFn: async ({ id, householdId, bought: value, userId }) => {
      assertQueuedBy(userId);
      return setItemBought(resolve(householdId, id), value);
    },
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
    onError: (error, { id, householdId }, context) => {
      if (droppedOnSignOut(error)) return;
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
      if (item) syncFailed(item.name, error);
    },
    // Not awaited: the mutation stays pending until onSettled returns, and a refetch finished in
    // the meantime would lay a change that failed back on top of the list (bloque 12).
    onSettled: (_data, _error, { householdId }) => {
      void invalidateShoppingWhenIdle(queryClient, householdId);
    },
  };

  // The row's stepper: each tap shows at once (optimistic), the save goes after a pause. Without a
  // connection it waits in the queue like an add or a bought, and is kept on the device with it
  // (bloque 11: «sin red, lo cotidiano se encola»).
  const quantity: MutationOptions<void, AppError, QuantityVars, QuantityContext> = {
    mutationKey: quantityKey,
    scope: SHOPPING_SCOPE,
    meta: QUEUED_META,
    networkMode: 'online',
    retry: retryOnNetwork,
    retryDelay: retryDelayOnNetwork,
    mutationFn: async ({ id, householdId, name, quantity: value, userId }) => {
      assertQueuedBy(userId);
      const target = resolve(householdId, id);
      // Bought (here or by someone else) or gone from a list that is here before its turn:
      // nothing left to change. Without the list in the cache it goes all the same, and the
      // server says if the item is gone (bloque 13, Aud P3-4: it used to do nothing, silently).
      const list = queryClient.getQueryData<ShoppingItem[]>(listKey(householdId));
      const item = list?.find((i) => i.id === target);
      if (list !== undefined && (!item || item.boughtAt !== null)) return;
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
      if (droppedOnSignOut(error)) return;
      const previous = context?.previous;
      if (previous) {
        queryClient.setQueryData<ShoppingItem[]>(listKey(householdId), (current) =>
          current ? applyQuantity(current, resolve(householdId, id), previous.quantity) : current,
        );
      }
      notify(shoppingErrorMessage(error));
    },
    // Not awaited: the mutation stays pending until onSettled returns, and a refetch finished in
    // the meantime would lay a change that failed back on top of the list (bloque 12).
    onSettled: (_data, _error, { householdId }) => {
      void invalidateShoppingWhenIdle(queryClient, householdId);
    },
  };

  return { add, bought, quantity };
}
