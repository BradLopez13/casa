import {
  onlineManager,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
  type MutateOptions,
} from '@tanstack/react-query';
import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { AppError } from '@/data/supabase/errors';
import { useNotice } from '@/ui/components/Notice';
import { isProvisional } from '@/domain/tasks/optimistic';
import type { TaskItem } from '@/domain/tasks/views';
import { t } from '@/i18n';
import { listTasks, skipTask } from './api';
import { hiddenTasks } from './deferredDelete';
import {
  buildToggleOptions,
  invalidateIfStale,
  runToggle,
  TOGGLE_KEY,
  type ToggleVars,
} from './toggle';

export const tasksKey = (householdId: string | undefined) => ['tasks', householdId] as const;

/** Start of the local day, 7 days ago, as an ISO instant. */
function sinceIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();
}

export function useTasks(householdId: string | undefined) {
  // A task deleted on screen stays out while its «Deshacer» lasts, whatever a refetch brings.
  const hidden = useSyncExternalStore(hiddenTasks.subscribe, hiddenTasks.get);
  const select = useCallback(
    (tasks: TaskItem[]) =>
      hidden.size === 0 ? tasks : tasks.filter((task) => !hidden.has(task.id)),
    [hidden],
  );
  return useQuery({
    queryKey: tasksKey(householdId),
    queryFn: () => listTasks(householdId as string, sinceIso()),
    enabled: householdId !== undefined,
    select,
  });
}

/**
 * The tasks deleted on screen whose «Deshacer» is still up, as the cache last had them: the door
 * of Hoy counts them as they were until the delete is confirmed or undone.
 */
export function useDeletingTasks(householdId: string | undefined): TaskItem[] {
  const hidden = useSyncExternalStore(hiddenTasks.subscribe, hiddenTasks.get);
  const select = useCallback(
    (tasks: TaskItem[]) => (hidden.size === 0 ? NONE : tasks.filter((task) => hidden.has(task.id))),
    [hidden],
  );
  const { data } = useQuery({
    queryKey: tasksKey(householdId),
    queryFn: () => listTasks(householdId as string, sinceIso()),
    enabled: householdId !== undefined,
    select,
  });
  return data ?? NONE;
}

const NONE: TaskItem[] = [];

/**
 * Runs a task RPC and refreshes the task list on success.
 *
 * `submit` is `mutate` for forms that close on success: it ignores calls while one is in flight
 * or after one succeeded, so a quick double tap runs the RPC (and the close) only once. The check
 * is synchronous because render-time `isPending` lags behind a double tap. A failure unlocks it
 * so the user can try again.
 */
export function useTaskMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  const locked = useRef(false);
  const mutation = useMutation<TResult, AppError, TArgs>({
    mutationFn: fn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => invalidateIfStale(queryClient, error),
  });
  const submit = (args: TArgs, options?: MutateOptions<TResult, AppError, TArgs>) => {
    if (locked.current) return;
    locked.current = true;
    mutation.mutate(args, {
      ...options,
      onError: (...params) => {
        locked.current = false;
        options?.onError?.(...params);
      },
    });
  };
  return { ...mutation, submit };
}

/**
 * Skips the current occurrence of a recurring task. The caller passes its `today`, so whatever
 * it shows about the next occurrence uses the same date the server does.
 */
export function useSkipTask(_householdId: string | undefined) {
  return useTaskMutation(({ id, today }: { id: string; today: string }) => skipTask(id, today));
}

/**
 * Completes or reopens a task, optimistically. Ignores a repeated tap while that task is in flight
 * and taps on provisional next occurrences, which only exist in the cache until the server creates
 * the real one. The opposite toggle (an undo) queues behind the pending one: see runToggle.
 */
export function useToggleTask(
  householdId: string | undefined,
  userId: string | null,
): { toggle: (vars: ToggleVars) => boolean; isBusy: (id: string) => boolean } {
  const queryClient = useQueryClient();
  const notify = useNotice();
  const options = buildToggleOptions(queryClient, householdId ?? '', userId ?? '', notify);
  const pending = useMutationState({
    filters: { mutationKey: TOGGLE_KEY, status: 'pending' },
    select: (m) => (m.state.variables as ToggleVars).id,
  });
  const isBusy = (id: string) => isProvisional({ id }) || pending.includes(id);
  // True when the toggle went; false when it could not, having said why if it was the network.
  const toggle = (vars: ToggleVars): boolean => {
    if (householdId === undefined || userId === null || isProvisional({ id: vars.id }))
      return false;
    // Without a connection it would go, come back and fail: say so before the tap does anything.
    if (!onlineManager.isOnline()) {
      notify(t(vars.done ? 'tasks.completeOffline' : 'tasks.reopenOffline'));
      return false;
    }
    // runToggle reads the mutation cache synchronously: render-time state lags a quick double tap.
    runToggle(queryClient, options, vars);
    return true;
  };
  return { toggle, isBusy };
}
