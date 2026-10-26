import { useMutationState, type Mutation } from '@tanstack/react-query';
import { isQueuedShoppingMutation } from '@/features/shopping/offline';
import { isQueuedTaskMutation } from '@/features/tasks/offline';

/**
 * Whether a mutation is a queued change (shopping or tasks) not yet on the server: signing out
 * clears the queue from the phone, so these would be lost (bloque 11, T2).
 */
export function isUnsentChange(mutation: Pick<Mutation, 'state' | 'options'>): boolean {
  const key = mutation.options.mutationKey;
  return (
    mutation.state.status === 'pending' &&
    (isQueuedShoppingMutation(key) || isQueuedTaskMutation(key))
  );
}

/** How many queued changes are still on their way to the server. */
export function useUnsentCount(): number {
  return useMutationState({ filters: { predicate: isUnsentChange } }).length;
}
