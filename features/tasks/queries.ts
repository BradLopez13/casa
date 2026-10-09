import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppError } from '@/data/supabase/errors';
import { useNotice } from '@/ui/components/Notice';
import { listTasks } from './api';
import { buildToggleOptions, invalidateIfStale, type ToggleVars } from './toggle';

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
    onError: (error) => invalidateIfStale(queryClient, error),
  });
}

/** Completes or reopens a task, optimistically. Ignores taps while that task is in flight. */
export function useToggleTask(
  householdId: string | undefined,
  userId: string | null,
): { toggle: (vars: ToggleVars) => void; isBusy: (id: string) => boolean } {
  const queryClient = useQueryClient();
  const notify = useNotice();
  const mutation = useMutation(
    buildToggleOptions(queryClient, householdId ?? '', userId ?? '', notify),
  );
  const pending = useMutationState({
    filters: { mutationKey: ['tasks', 'toggle'], status: 'pending' },
    select: (m) => (m.state.variables as ToggleVars).id,
  });
  const isBusy = (id: string) => pending.includes(id);
  const toggle = (vars: ToggleVars) => {
    if (householdId === undefined || userId === null) return;
    // Check the cache synchronously: render-time state lags behind a quick double tap.
    const inFlight = queryClient
      .getMutationCache()
      .findAll({ mutationKey: ['tasks', 'toggle'], status: 'pending' })
      .some((m) => (m.state.variables as ToggleVars | undefined)?.id === vars.id);
    if (inFlight) return;
    mutation.mutate(vars);
  };
  return { toggle, isBusy };
}
