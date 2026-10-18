import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { AppError } from '@/data/supabase/errors';
import { applyQuantity, type ShoppingItem } from '@/domain/shopping/list';
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
  invalidateShoppingWhenIdle,
  SHOPPING_SCOPE,
  shoppingQueryOptions,
  type AddContext,
  type AddVars,
  type BoughtContext,
  type BoughtVars,
} from './offline';

export const shoppingKey = (householdId: string | undefined) => ['shopping', householdId] as const;
export const shoppingHistoryKey = (householdId: string | undefined) =>
  ['shopping-history', householdId] as const;

export function useShoppingItems(householdId: string | undefined) {
  return useQuery({
    queryKey: shoppingKey(householdId),
    queryFn: () => listShoppingItems(householdId as string),
    enabled: householdId !== undefined,
    ...shoppingQueryOptions,
  });
}

export function useShoppingHistory(householdId: string | undefined) {
  return useQuery({
    queryKey: shoppingHistoryKey(householdId),
    queryFn: () => shoppingHistory(householdId as string),
    enabled: householdId !== undefined,
    ...shoppingQueryOptions,
  });
}

/** Adds an item, optimistically; queued while offline. Its options are the registered defaults. */
export function useAddItem() {
  return useMutation<string, AppError, AddVars, AddContext>({ mutationKey: addKey });
}

/** Marks an item bought or not, optimistically; queued while offline. */
export function useSetBought() {
  return useMutation<void, AppError, BoughtVars, BoughtContext>({ mutationKey: boughtKey });
}

export type EditVars = { id: string; name: string; quantity: string | null };

// Edits, deletes and clears only run online: they are not persisted, so they never outlive
// the app. They share the scope so they reach the server after any queued add or bought.
export function useEditItem() {
  const queryClient = useQueryClient();
  return useMutation<void, AppError, EditVars>({
    mutationKey: ['shopping', 'edit'],
    scope: SHOPPING_SCOPE,
    networkMode: 'online',
    mutationFn: ({ id, name, quantity }) => updateShoppingItem(id, name, quantity),
    onSettled: () => invalidateShoppingWhenIdle(queryClient),
  });
}

export type QuantityVars = {
  id: string;
  householdId: string;
  name: string;
  quantity: string | null;
};
export type QuantityContext = { previous: ShoppingItem[] | undefined };

/**
 * Sets an item's quantity from the row, optimistically: the stepper shows each tap at once and
 * saves after a pause. Online only, like the other edits; an error puts the old list back.
 */
export function useSetQuantity() {
  const queryClient = useQueryClient();
  return useMutation<void, AppError, QuantityVars, QuantityContext>({
    mutationKey: ['shopping', 'quantity'],
    scope: SHOPPING_SCOPE,
    networkMode: 'online',
    mutationFn: ({ id, name, quantity }) => updateShoppingItem(id, name, quantity),
    onMutate: async ({ id, householdId, quantity }) => {
      const key = shoppingKey(householdId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ShoppingItem[]>(key);
      if (previous) queryClient.setQueryData(key, applyQuantity(previous, id, quantity));
      return { previous };
    },
    onError: (_error, { householdId }, context) => {
      if (context?.previous) queryClient.setQueryData(shoppingKey(householdId), context.previous);
    },
    onSettled: () => invalidateShoppingWhenIdle(queryClient),
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();
  return useMutation<void, AppError, { id: string }>({
    mutationKey: ['shopping', 'delete'],
    scope: SHOPPING_SCOPE,
    networkMode: 'online',
    mutationFn: ({ id }) => deleteShoppingItem(id),
    onSettled: () => invalidateShoppingWhenIdle(queryClient),
  });
}

export function useClearBought() {
  const queryClient = useQueryClient();
  return useMutation<void, AppError, { householdId: string }>({
    mutationKey: ['shopping', 'clear'],
    scope: SHOPPING_SCOPE,
    networkMode: 'online',
    mutationFn: ({ householdId }) => clearBoughtItems(householdId),
    onSettled: () => invalidateShoppingWhenIdle(queryClient),
  });
}

/** Ids of the items with a shopping mutation still on its way to the server. */
export function usePendingItemIds(): Set<string> {
  const ids = useMutationState({
    filters: { mutationKey: ['shopping'], status: 'pending' },
    select: (m) => (m.state.variables as { id?: string } | undefined)?.id,
  });
  const key = ids.filter((id): id is string => id !== undefined).join('\n');
  return useMemo(() => new Set(key === '' ? [] : key.split('\n')), [key]);
}
