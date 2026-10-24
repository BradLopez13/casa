import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { QueryClient } from '@tanstack/react-query';
import { membershipKey } from '@/features/households/keys';

/**
 * The on-device copy of the query cache: the shopping list, its history and its queue, the
 * tasks and their queue, the membership and the members.
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

/**
 * Removes one household's shopping data, tasks, members and queued changes (or every
 * household's): a queue left for a household the user left would only fail, one notice each.
 */
function removeHouseholdData(queryClient: QueryClient, householdId?: string): void {
  const scoped = (kind: string) => (householdId === undefined ? [kind] : [kind, householdId]);
  queryClient.removeQueries({ queryKey: scoped('shopping') });
  queryClient.removeQueries({ queryKey: scoped('shopping-history') });
  queryClient.removeQueries({ queryKey: scoped('shopping-resolved') });
  queryClient.removeQueries({ queryKey: scoped('members') });
  queryClient.removeQueries({ queryKey: scoped('tasks') });
  const mutations = queryClient.getMutationCache();
  const queued = [
    ...mutations.findAll({ mutationKey: ['shopping'] }),
    ...mutations.findAll({ mutationKey: ['tasks'] }),
  ];
  for (const mutation of queued) {
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
