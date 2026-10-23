import type { DehydrateOptions, MutationKey, QueryClient, QueryKey } from '@tanstack/react-query';
import { isQueuedShoppingMutation, resumeShoppingQueue } from '@/features/shopping/offline';
import { isQueuedTaskMutation, resumeTasksQueue } from '@/features/tasks/offline';

const PERSISTED_QUERIES: ReadonlySet<unknown> = new Set([
  'shopping',
  'shopping-history',
  'shopping-resolved',
  'membership',
  'members',
  'tasks',
]);

/**
 * Kept on the device: the shopping list, its history and the queue's resolved ids, the tasks
 * (an offline cold start shows Hoy and Tareas as they were, with the band; fase 10e), plus the
 * membership (an offline cold start gets past the route guard) and the members (the magnets).
 */
export function shouldPersistQuery(queryKey: QueryKey): boolean {
  return PERSISTED_QUERIES.has(queryKey[0]);
}

/** Only the queued shopping and task mutations survive a restart. */
export function shouldPersistMutation(mutationKey: MutationKey | undefined): boolean {
  return isQueuedShoppingMutation(mutationKey) || isQueuedTaskMutation(mutationKey);
}

/**
 * What goes on the device: settled persisted queries, and every queued mutation still pending.
 * That includes one in flight or waiting to retry when the app closes; resending it is safe: an
 * add or a create is idempotent by id, a bought or a toggle sets an absolute value.
 */
export const persistDehydrateOptions: DehydrateOptions = {
  shouldDehydrateQuery: (query) =>
    shouldPersistQuery(query.queryKey) && query.state.status === 'success',
  shouldDehydrateMutation: (mutation) =>
    mutation.state.status === 'pending' && shouldPersistMutation(mutation.options.mutationKey),
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
