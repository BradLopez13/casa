import type { DehydrateOptions, MutationKey, QueryClient, QueryKey } from '@tanstack/react-query';
import { isQueuedShoppingMutation, resumeShoppingQueue } from '@/features/shopping/offline';
import { isQueuedTaskMutation, resumeTasksQueue } from '@/features/tasks/offline';

const PERSISTED_QUERIES: ReadonlySet<unknown> = new Set([
  'shopping',
  'shopping-history',
  'shopping-resolved',
  'membership',
  'households',
  'members',
  'tasks',
]);

/**
 * Kept on the device: the shopping list, its history and the queue's resolved ids, the tasks
 * (an offline cold start shows Hoy and Tareas as they were, with the band; fase 10e), plus the
 * membership and the household list (an offline cold start gets past the route guard and can
 * still switch household; bloque 12) and the members (the magnets).
 */
export function shouldPersistQuery(queryKey: QueryKey): boolean {
  return PERSISTED_QUERIES.has(queryKey[0]);
}

/** Only the queued shopping (add, bought, quantity) and task mutations survive a restart. */
export function shouldPersistMutation(mutationKey: MutationKey | undefined): boolean {
  return isQueuedShoppingMutation(mutationKey) || isQueuedTaskMutation(mutationKey);
}

/**
 * A change that goes in the queue's own key (`queueStore`): every queued mutation still pending,
 * one in flight or waiting to retry when the app closes included. Resending it is safe: an add or
 * a create is idempotent by id, a bought or a toggle sets an absolute value.
 */
export const shouldQueueMutation = (mutation: {
  state: { status: string };
  options: { mutationKey?: MutationKey };
}) => mutation.state.status === 'pending' && shouldPersistMutation(mutation.options.mutationKey);

/**
 * What goes in the cache on the device: settled persisted queries. The queue no longer goes with
 * them: it has its own key per person (`queueStore`), so an update or a new `CACHE_SCHEMA`, which
 * discard this cache, never take it (bloque 13, P2-3).
 */
export const persistDehydrateOptions: DehydrateOptions = {
  // A list whose last refresh failed (offline) keeps its data: it is kept too, or the next cold
  // start without a connection would find it gone (bloque 12: the household list after a
  // switch offline).
  shouldDehydrateQuery: (query) =>
    shouldPersistQuery(query.queryKey) &&
    (query.state.status === 'success' ||
      (query.state.status === 'error' && query.state.data !== undefined)),
  shouldDehydrateMutation: () => false,
};

/**
 * Bumped when what the cache holds changes shape (v2: shopping without categories; v3: the tasks
 * and their queue kept too, fase 10e), so a cache an older build wrote under the same app version
 * is discarded too. A change to `TaskItem` or `ShoppingItem` bumps it.
 */
const CACHE_SCHEMA = 'v3';

/** A persisted cache from another app version, another schema or another user is discarded. */
export function persistBuster(appVersion: string, userId: string | null): string {
  return `${appVersion}:${userId ?? 'anon'}:${CACHE_SCHEMA}`;
}

/** Both queues, restored from the device, go on: each in its own order. */
export function resumeQueues(queryClient: QueryClient): Promise<unknown> {
  return Promise.all([resumeShoppingQueue(queryClient), resumeTasksQueue(queryClient)]);
}
