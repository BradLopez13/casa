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

/**
 * Leaving or deleting the household: forgets its shopping data and members, in memory and on
 * the device. The membership becomes "no household" at once (a user is in one household at
 * most), so neither the route guard nor a save before the refetch keeps the old one around.
 */
export function forgetHouseholdData(queryClient: QueryClient): void {
  queryClient.removeQueries({ queryKey: ['shopping'] });
  queryClient.removeQueries({ queryKey: ['shopping-history'] });
  queryClient.removeQueries({ queryKey: ['members'] });
  queryClient.setQueryData(membershipKey, null);
  const mutations = queryClient.getMutationCache();
  for (const mutation of mutations.findAll({ mutationKey: ['shopping'] })) {
    mutations.remove(mutation);
  }
  void persister.removeClient();
}
