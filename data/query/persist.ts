import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { dehydrate, type DehydrateOptions, type QueryClient } from '@tanstack/react-query';
import { pickActive } from '@/features/households/active';
import { householdsKey, membershipKey } from '@/features/households/keys';

/**
 * The on-device copy of the query cache: the shopping list, its history and its queue, the
 * tasks and their queue, the membership and the members.
 */
const CACHE_KEY = 'casa-query-cache';

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: CACHE_KEY,
});

/**
 * Saves the cache now, past the persister's one-second throttle: the app going to the background
 * may be the last moment it runs, and a tap just before closing it would otherwise be lost (bloque
 * 13, Aud P3-3). The same shape the persister writes, so the restore reads it as its own.
 */
export function saveCacheNow(
  queryClient: QueryClient,
  buster: string,
  dehydrateOptions: DehydrateOptions,
): Promise<void> {
  const client = {
    buster,
    timestamp: Date.now(),
    clientState: dehydrate(queryClient, dehydrateOptions),
  };
  return AsyncStorage.setItem(CACHE_KEY, JSON.stringify(client));
}

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
  queryClient.removeQueries({ queryKey: scoped('license') });
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
 * Leaving or deleting a household: forgets its shopping data, tasks, members and queue, in
 * memory and on the device. The app moves at once to the next household (bloque 12), or to none,
 * so neither the route guard nor a save before the refetch keeps the old one around. The other
 * households' data and queues stay: the device copy follows the cache.
 */
export function forgetHouseholdData<T extends { householdId: string }>(
  queryClient: QueryClient,
  householdId: string,
): T | null {
  removeHouseholdData(queryClient, householdId);
  const rest = (queryClient.getQueryData<T[]>(householdsKey) ?? []).filter(
    (h) => h.householdId !== householdId,
  );
  const next = pickActive(rest, null);
  queryClient.setQueryData(householdsKey, rest);
  queryClient.setQueryData(membershipKey, next);
  if (rest.length === 0) void persister.removeClient();
  return next;
}

/**
 * A membership that ended from someone else's side (removed, or the household deleted): forgets
 * that household's data, in memory and, as the device copy follows the cache, on the device. The
 * membership is already the new one.
 */
export function forgetEndedHousehold(queryClient: QueryClient, householdId: string): void {
  removeHouseholdData(queryClient, householdId);
}
