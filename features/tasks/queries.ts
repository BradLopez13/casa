import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toAppError, type AppError } from '@/data/supabase/errors';
import { membershipKey } from '@/features/households/queries';
import { listTasks } from './api';

export const tasksKey = (householdId: string | undefined) => ['tasks', householdId] as const;

/** Start of the local day, 7 days ago, as an ISO instant. */
function sinceIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();
}

export function useTasks(householdId: string | undefined) {
  return useQuery({
    queryKey: tasksKey(householdId),
    queryFn: () => listTasks(householdId as string, sinceIso()),
    enabled: householdId !== undefined,
  });
}

/** Runs a task RPC and refreshes the task list on success. */
export function useTaskMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation<TResult, AppError, TArgs>({
    mutationFn: fn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    // Our view of the household is stale (task gone, we left, or the assignee left): refetch
    // tasks, membership and members so the UI and the route guard catch up.
    onError: async (error) => {
      const code = toAppError(error).code;
      if (code === 'TASK_NOT_FOUND' || code === 'NOT_A_MEMBER' || code === 'INVALID_ASSIGNEE') {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['tasks'] }),
          queryClient.invalidateQueries({ queryKey: membershipKey }),
          queryClient.invalidateQueries({ queryKey: ['members'] }),
        ]);
      }
    },
  });
}
