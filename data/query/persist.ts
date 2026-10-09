import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { QueryClient } from '@tanstack/react-query';
import { membershipKey } from '@/features/households/keys';

/**
 * The on-device copy of the query cache: the shopping list, its history and its queue, the
 * membership and the members.
 */
export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'casa-query-cache',
});

/** Signing out: forgets everything cached, in memory and on the device. */
export function forgetCachedData(queryClient: QueryClient): void {
  queryClient.clear();
  void persister.removeClient();
}

/** Removes one household's shopping data, members and queued shopping changes (or every household's). */
function removeHouseholdData(queryClient: QueryClient, householdId?: string): void {
  const scoped = (kind: string) => (householdId === undefined ? [kind] : [kind, householdId]);
  queryClient.removeQueries({ queryKey: scoped('shopping') });
  queryClient.removeQueries({ queryKey: scoped('shopping-history') });
  queryClient.removeQueries({ queryKey: scoped('members') });
  const mutations = queryClient.getMutationCache();
  for (const mutation of mutations.findAll({ mutationKey: ['shopping'] })) {
    const variables = mutation.state.variables as { householdId?: unknown } | undefined;
    if (householdId === undefined || variables?.householdId === householdId) {
      mutations.remove(mutation);
    }
  }
}

/**
 * Leaving or deleting the household: forgets its shopping data and members, in memory and on
 * the device. The membership becomes "no household" at once (a user is in one household at
 * most), so neither the route guard nor a save before the refetch keeps the old one around.
 */
export function forgetHouseholdData(queryClient: QueryClient): void {
  removeHouseholdData(queryClient);
  queryClient.setQueryData(membershipKey, null);
  void persister.removeClient();
}

/**
 * A membership that ended from someone else's side (removed, or the household deleted): forgets
 * that household's data, in memory and on the device. The membership is already the new one.
 */
export function forgetEndedHousehold(queryClient: QueryClient, householdId: string): void {
  removeHouseholdData(queryClient, householdId);
  void persister.removeClient();
}
