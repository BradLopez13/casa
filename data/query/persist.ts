import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { QueryClient } from '@tanstack/react-query';

/** The on-device copy of the query cache: the shopping list, its history and its queue. */
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
 * Leaving or deleting the household: forgets its shopping data, in memory and on the device.
 * The rest of the cache stays, so the route guard sees the membership change.
 */
export function forgetHouseholdData(queryClient: QueryClient): void {
  queryClient.removeQueries({ queryKey: ['shopping'] });
  queryClient.removeQueries({ queryKey: ['shopping-history'] });
  const mutations = queryClient.getMutationCache();
  for (const mutation of mutations.findAll({ mutationKey: ['shopping'] })) {
    mutations.remove(mutation);
  }
  void persister.removeClient();
}
