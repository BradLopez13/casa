import { useQueries, useQueryClient } from '@tanstack/react-query';
import {
  shoppingHistoryQueryOptions,
  shoppingItemsQueryOptions,
} from '@/features/shopping/queries';
import { tasksQueryOptions } from '@/features/tasks/queries';
import { listMembers } from './api';
import { membersKey } from './keys';
import { useHouseholds } from './queries';

/**
 * Keeps every household's tasks, shopping and members loaded and on the device, not only the one
 * shown (bloque 12): switching household without a connection, or starting the app offline in
 * any of them, finds what it had. The same queries as the screens', so nothing loads twice.
 */
export function useWarmHouseholds(): void {
  const queryClient = useQueryClient();
  const ids = (useHouseholds().data ?? []).map((h) => h.householdId);
  useQueries({
    queries: ids.flatMap((id) => [
      tasksQueryOptions(queryClient, id),
      shoppingItemsQueryOptions(queryClient, id),
      shoppingHistoryQueryOptions(id),
      { queryKey: membersKey(id), queryFn: () => listMembers(id) },
    ]),
    // Nothing here is drawn: no re-render when one of them changes.
    combine: () => null,
  });
}
