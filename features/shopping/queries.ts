import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useMemo } from 'react';
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
  boughtKey,
  countsAsUnsent,
  invalidateShoppingWhenIdle,
  quantityKey,
  shoppingScope,
  shoppingQueryOptions,
  type AddContext,
  type AddVars,
  type BoughtContext,
  type BoughtVars,
  type QuantityContext,
  type QuantityVars,
} from './offline';
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
  return useQuery({
    ...shoppingItemsQueryOptions(queryClient, householdId as string),
    enabled: householdId !== undefined,
  });
}

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

// Edits, deletes and clears only run online: they are not persisted, so they never outlive
// the app. They share the scope so they reach the server after any queued add or bought.
export function useEditItem(householdId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation<void, AppError, EditVars>({
    mutationKey: ['shopping', 'edit'],
    scope: shoppingScope(householdId),
    networkMode: 'online',
    mutationFn: ({ id, name, quantity }) => updateShoppingItem(id, name, quantity),
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

export function useDeleteItem(householdId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation<void, AppError, { id: string }>({
    mutationKey: ['shopping', 'delete'],
    scope: shoppingScope(householdId),
    networkMode: 'online',
    mutationFn: ({ id }) => deleteShoppingItem(id),
    onSettled: () => invalidateShoppingWhenIdle(queryClient, householdId),
  });
}

/**
 * Clears the bought items. Optimistic: they leave the cached list as the clear starts (the undo
 * window has already hidden them), and come back if the server refuses.
 */
export function useClearBought(householdId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation<void, AppError, { householdId: string }, { before?: ShoppingItem[] }>({
    mutationKey: ['shopping', 'clear'],
    scope: shoppingScope(householdId),
    networkMode: 'online',
    mutationFn: ({ householdId }) => clearBoughtItems(householdId),
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

/** Ids of the items with a shopping mutation still on its way to the server. */
export function usePendingItemIds(): Set<string> {
  const ids = useMutationState({
    filters: { mutationKey: ['shopping'], status: 'pending' },
    select: (m) =>
      countsAsUnsent(m.options.mutationKey, m.state.isPaused)
        ? (m.state.variables as { id?: string } | undefined)?.id
        : undefined,
  });
  const key = ids.filter((id): id is string => id !== undefined).join('\n');
  return useMemo(() => new Set(key === '' ? [] : key.split('\n')), [key]);
}
