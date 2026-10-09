import type { MutationOptions, QueryClient } from '@tanstack/react-query';
import { toAppError, type AppError } from '@/data/supabase/errors';
import { membershipKey } from '@/features/households/keys';
import { localDateIso } from '@/domain/tasks/dates';
import { applyToggle } from '@/domain/tasks/optimistic';
import type { TaskItem } from '@/domain/tasks/views';
import { t } from '@/i18n';
import { completeTask, reopenTask } from './api';

export type ToggleVars = { id: string; done: boolean };
type Context = { previous: TaskItem | undefined };

const TOGGLE_KEY = ['tasks', 'toggle'] as const;

/**
 * Our view of the household is stale (task gone, we left, or the assignee left): refetch
 * tasks, membership and members so the UI and the route guard catch up.
 */
export async function invalidateIfStale(queryClient: QueryClient, error: unknown): Promise<void> {
  const code = toAppError(error).code;
  if (code === 'TASK_NOT_FOUND' || code === 'NOT_A_MEMBER' || code === 'INVALID_ASSIGNEE') {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      queryClient.invalidateQueries({ queryKey: membershipKey }),
      queryClient.invalidateQueries({ queryKey: ['members'] }),
    ]);
  }
}

export function buildToggleOptions(
  queryClient: QueryClient,
  householdId: string,
  userId: string,
  notify: (message: string) => void,
): MutationOptions<void, AppError, ToggleVars, Context> {
  const key = ['tasks', householdId];
  return {
    mutationKey: TOGGLE_KEY,
    mutationFn: ({ id, done }) =>
      done ? completeTask(id, localDateIso(new Date())) : reopenTask(id),
    onMutate: async ({ id, done }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TaskItem[]>(key)?.find((task) => task.id === id);
      queryClient.setQueryData<TaskItem[]>(key, (current) =>
        current ? applyToggle(current, id, done, userId, new Date().toISOString()) : current,
      );
      return { previous };
    },
    // Roll back only this task: other toggles in flight keep their optimistic state.
    onError: async (error, { id }, context) => {
      const previous = context?.previous;
      if (previous) {
        queryClient.setQueryData<TaskItem[]>(key, (current) =>
          current?.map((task) => (task.id === id ? previous : task)),
        );
      }
      notify(t('tasks.toggleFailed'));
      await invalidateIfStale(queryClient, error);
    },
    // Several toggles can be in flight: refetch once, after the last one settles.
    onSettled: async () => {
      if (queryClient.isMutating({ mutationKey: TOGGLE_KEY }) === 1) {
        await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      }
    },
  };
}
