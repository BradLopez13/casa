import type { MutationKey, QueryClient } from '@tanstack/react-query';
import { CREATE_KEY } from './create';
import { TOGGLE_KEY } from './toggle';

/**
 * The queued task mutations, create and complete or reopen (fase 10e): theirs are the task
 * mutation functions registered as defaults before the cache is restored.
 */
export function isQueuedTaskMutation(mutationKey: MutationKey | undefined): boolean {
  return (
    mutationKey?.[0] === 'tasks' &&
    (mutationKey[1] === TOGGLE_KEY[1] || mutationKey[1] === CREATE_KEY[1])
  );
}

/**
 * Resumes the restored task queue in order (one scope serializes it), as `resumeShoppingQueue`
 * does. A restored task mutation this build does not queue has no function to run and would block
 * the scope for ever: it is dropped.
 */
export function resumeTasksQueue(queryClient: QueryClient): Promise<unknown> {
  const cache = queryClient.getMutationCache();
  const stale = cache.findAll({
    predicate: (m) =>
      m.options.mutationKey?.[0] === 'tasks' && !isQueuedTaskMutation(m.options.mutationKey),
  });
  for (const mutation of stale) cache.remove(mutation);
  const queued = cache.findAll({
    status: 'pending',
    predicate: (m) => isQueuedTaskMutation(m.options.mutationKey),
  });
  return Promise.all(queued.map((m) => m.continue().catch(() => undefined)));
}
