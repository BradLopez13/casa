import {
  onlineManager,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useMemo, useSyncExternalStore } from 'react';
import type { AppError } from '@/data/supabase/errors';
import type { Category } from '@/domain/shopping/categories';
import {
  clearBoughtItems,
  deleteShoppingItem,
  listItemCategories,
  listShoppingItems,
  setCategoryOrder,
  shoppingHistory,
  updateShoppingItem,
  type ItemCategories,
} from './api';
import {
  addKey,
  boughtKey,
  categoryKey,
  invalidateShoppingWhenIdle,
  itemCategoriesKey,
  SHOPPING_SCOPE,
  shoppingQueryOptions,
  type AddContext,
  type AddVars,
  type BoughtContext,
  type BoughtVars,
  type CategoryContext,
  type CategoryVars,
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

/**
 * The household's aisle order (null for the default) and its corrections, by normalized name.
 * Refreshed by the household broadcast (corrections and households) like the list.
 */
export function useItemCategories(householdId: string | undefined) {
  const query = useQuery({
    queryKey: itemCategoriesKey(householdId),
    queryFn: () => listItemCategories(householdId as string),
    enabled: householdId !== undefined,
    ...shoppingQueryOptions,
  });
  const data = query.data;
  const overrides = useMemo(() => new Map(data?.overrides ?? []), [data]);
  return { query, order: data?.order ?? null, overrides };
}

/** Adds an item, optimistically; queued while offline. Its options are the registered defaults. */
export function useAddItem() {
  return useMutation<string, AppError, AddVars, AddContext>({ mutationKey: addKey });
}

/** Marks an item bought or not, optimistically; queued while offline. */
export function useSetBought() {
  return useMutation<void, AppError, BoughtVars, BoughtContext>({ mutationKey: boughtKey });
}

/** Changes an item's category for the household, optimistically; queued while offline. */
export function useSetCategory() {
  return useMutation<void, AppError, CategoryVars, CategoryContext>({ mutationKey: categoryKey });
}

/** Saves the household's aisle order; online only, like the other settings. */
export function useSetCategoryOrder() {
  const queryClient = useQueryClient();
  return useMutation<void, AppError, { householdId: string; order: readonly Category[] }>({
    mutationKey: ['shopping-categories', 'order'],
    networkMode: 'online',
    mutationFn: ({ order }) => setCategoryOrder(order),
    onMutate: async ({ householdId, order }) => {
      const key = itemCategoriesKey(householdId);
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<ItemCategories>(key, (current) =>
        current ? { ...current, order: [...order] } : current,
      );
    },
    onSettled: (_data, _error, { householdId }) =>
      queryClient.invalidateQueries({ queryKey: itemCategoriesKey(householdId) }),
  });
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

const subscribeOnline = (onChange: () => void) => onlineManager.subscribe(onChange);
const isOnline = () => onlineManager.isOnline();

export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, isOnline);
}
