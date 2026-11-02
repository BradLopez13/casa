import { hiddenItems } from './deferredDelete';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import type { AppError } from '@/data/supabase/errors';
import type { ShoppingItem } from '@/domain/shopping/list';
import {
  clearBoughtItems,
  deleteShoppingItem,
  listShoppingItems,
  shoppingHistory,
  updateShoppingItem,
} from './api';
import {
  addKey,
  afterShoppingQueue,
  dropQueuedQuantities,
  boughtKey,
  invalidateShoppingWhenIdle,
  quantityKey,
  resolvedItemId,
  shoppingScope,
  shoppingQueryOptions,
  type AddContext,
  type AddVars,
  type BoughtContext,
  type BoughtVars,
  type QuantityContext,
  type QuantityVars,
} from './offline';
import { useQueueSnapshot } from '@/features/offline/useQueue';
import { pendingShopping, withQueuedShopping } from './pending';

export const shoppingKey = (householdId: string | undefined) => ['shopping', householdId] as const;
export const shoppingHistoryKey = (householdId: string | undefined) =>
  ['shopping-history', householdId] as const;

/**
 * A household's shopping list, as Compra loads it; also kept loaded for the households not shown
 * (`useWarmHouseholds`, bloque 12).
 */
export function shoppingItemsQueryOptions(queryClient: QueryClient, householdId: string) {
  return {
    queryKey: shoppingKey(householdId),
    // What the queue still holds goes on top of what the server sends (`withQueuedShopping`).
    queryFn: async () => {
      // Taken before the request: a change that lands while it runs is in neither the list it
      // reads nor the queue once it answers.
      const before = pendingShopping(queryClient);
      const items = await listShoppingItems(householdId);
      return withQueuedShopping(queryClient, householdId, items, before);
    },
    ...shoppingQueryOptions,
  };
}

/** A household's usual items, as Compra loads them. */
export function shoppingHistoryQueryOptions(householdId: string) {
  return {
    queryKey: shoppingHistoryKey(householdId),
    queryFn: () => shoppingHistory(householdId),
    ...shoppingQueryOptions,
  };
}

export function useShoppingItems(householdId: string | undefined) {
  const queryClient = useQueryClient();
  // A product deleted on screen stays out while its «Deshacer» lasts (decisión 2, bloque 13).
  const hidden = useSyncExternalStore(hiddenItems.subscribe, hiddenItems.get);
  const select = useCallback(
    (items: ShoppingItem[]) =>
      hidden.size === 0 ? items : items.filter((item) => !hidden.has(item.id)),
    [hidden],
  );
  return useQuery({
    ...shoppingItemsQueryOptions(queryClient, householdId as string),
    enabled: householdId !== undefined,
    select,
  });
}

/**
 * The products deleted on screen whose «Deshacer» is still up, as the cache last had them: «lo de
 * siempre» does not offer them back while they may yet come back (bloque 14.5, P3).
 */
export function useDeletingItems(householdId: string | undefined): readonly ShoppingItem[] {
  const queryClient = useQueryClient();
  const hidden = useSyncExternalStore(hiddenItems.subscribe, hiddenItems.get);
  const { data } = useQuery({
    ...shoppingItemsQueryOptions(queryClient, householdId as string),
    enabled: householdId !== undefined,
    select: useCallback(
      (items: ShoppingItem[]) =>
        hidden.size === 0 ? NO_DELETING : items.filter((item) => hidden.has(item.id)),
      [hidden],
    ),
  });
  return data ?? NO_DELETING;
}

const NO_DELETING: readonly ShoppingItem[] = [];

export function useShoppingHistory(householdId: string | undefined) {
  return useQuery({
    ...shoppingHistoryQueryOptions(householdId as string),
    enabled: householdId !== undefined,
  });
}

/** Adds an item, optimistically; queued while offline. Its options are the registered defaults. */
export function useAddItem(householdId: string | undefined) {
  return useMutation<string, AppError, AddVars, AddContext>({
    mutationKey: addKey,
    scope: shoppingScope(householdId),
  });
}

/** Marks an item bought or not, optimistically; queued while offline. */
export function useSetBought(householdId: string | undefined) {
  return useMutation<void, AppError, BoughtVars, BoughtContext>({
    mutationKey: boughtKey,
    scope: shoppingScope(householdId),
  });
}

export type EditVars = { id: string; name: string; quantity: string | null };

// Edits, deletes and clears only run online: they are not persisted, so they never outlive the
// app. They go after the household's queued changes, but never wait for them more than a while
// (`afterShoppingQueue`, bloque 14.4, T7), and reach the item an add was merged into.
export function useEditItem(householdId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation<void, AppError, EditVars>({
    mutationKey: ['shopping', 'edit'],
    networkMode: 'online',
    mutationFn: async ({ id, name, quantity }) => {
      await afterShoppingQueue(queryClient, householdId);
      const target = resolvedItemId(queryClient, householdId, id);
      await updateShoppingItem(target, name, quantity);
      // What the sheet saved is the last word on its quantity.
      dropQueuedQuantities(queryClient, householdId, target);
    },
    onSettled: () => invalidateShoppingWhenIdle(queryClient, householdId),
  });
}

/** Sets an item's quantity from the row's stepper; its options are the registered defaults. */
export function useSetQuantity(householdId: string | undefined) {
  return useMutation<void, AppError, QuantityVars, QuantityContext>({
    mutationKey: quantityKey,
    scope: shoppingScope(householdId),
  });
}

/**
 * Deletes a product once its «Deshacer» has gone (decisión 2, bloque 13), outside any screen: the
 * product sheet is closed by then. After an add or a quantity of the household still on its way,
 * for a while at most (T7); offline it fails at once and the product comes back.
 */
export function deleteItemNow(
  queryClient: QueryClient,
  householdId: string | undefined,
  id: string,
): Promise<void> {
  return queryClient
    .getMutationCache()
    .build<void, AppError, void, unknown>(queryClient, {
      mutationKey: ['shopping', 'delete'],
      mutationFn: async () => {
        await afterShoppingQueue(queryClient, householdId);
        return deleteShoppingItem(resolvedItemId(queryClient, householdId, id));
      },
      // Out of the cache first: a refetch that fails (offline right after) must not bring it back.
      onSuccess: () => {
        if (householdId === undefined) return;
        queryClient.setQueryData<ShoppingItem[]>(shoppingKey(householdId), (current) =>
          current?.filter((entry) => entry.id !== id),
        );
      },
      onSettled: () => invalidateShoppingWhenIdle(queryClient, householdId),
    })
    .execute(undefined);
}

/**
 * Clears the bought items. Optimistic: they leave the cached list as the clear starts (the undo
 * window has already hidden them), and come back if the server refuses.
 */
export function useClearBought(householdId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation<void, AppError, { householdId: string }, { before?: ShoppingItem[] }>({
    mutationKey: ['shopping', 'clear'],
    networkMode: 'online',
    mutationFn: async ({ householdId }) => {
      await afterShoppingQueue(queryClient, householdId);
      return clearBoughtItems(householdId);
    },
    onMutate: async ({ householdId }) => {
      const key = shoppingKey(householdId);
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<ShoppingItem[]>(key);
      queryClient.setQueryData<ShoppingItem[]>(key, (items) =>
        items?.filter((item) => item.boughtAt === null),
      );
      return { before };
    },
    onError: (_error, { householdId }, context) => {
      if (context?.before) queryClient.setQueryData(shoppingKey(householdId), context.before);
    },
    onSettled: () => invalidateShoppingWhenIdle(queryClient, householdId),
  });
}

/**
 * Ids of the items with a queued change waiting to reach the server (add, bought, quantity): their
 * row says «Sin enviar». The same rule as the tasks (`useQueueSnapshot`, bloque 14.1): once it had
 * to wait, until it arrives; a change at its first try is not marked.
 */
export function usePendingItemIds(): ReadonlySet<string> {
  return useQueueSnapshot().waiting;
}
