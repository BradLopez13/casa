import { MutationObserver, type MutationOptions, type QueryClient } from '@tanstack/react-query';
import { toAppError, type AppError } from '@/data/supabase/errors';
import { membershipKey } from '@/features/households/keys';
import { localDateIso } from '@/domain/tasks/dates';
import { applyToggle } from '@/domain/tasks/optimistic';
import type { TaskItem } from '@/domain/tasks/views';
import { t } from '@/i18n';
import { retryDelayOnNetwork, retryOnNetwork } from '@/data/query/retry';
import { taskErrorMessage } from './errors';
import { completeTask, reopenTask } from './api';
import { markFresh } from './freshIds';
import { tasksKey } from './keys';

/**
 * One complete or reopen. The household and the person ride with it, so a toggle queued offline
 * still knows where to land after a restart (fase 10e), and so does the moment of the tap (`at`,
 * bloque 11): a task marked without a connection keeps that time when it arrives. A toggle
 * restored from an older build has none and goes as of its sending.
 */
export type ToggleVars = {
  id: string;
  done: boolean;
  householdId: string;
  userId: string;
  at?: string;
};
type Context = { previous: TaskItem | undefined; successor: TaskItem | undefined };

export const TOGGLE_KEY = ['tasks', 'toggle'] as const;

/**
 * Every queued task change (create, complete, reopen) shares one scope, as the shopping queue
 * does: a complete queued behind the create of the same task reaches the server after it.
 */
export const TASKS_SCOPE = { id: 'tasks' };

/** Several task changes can be on their way: refetch once, after the last one settles. */
export async function invalidateTasksWhenIdle(queryClient: QueryClient): Promise<void> {
  if (queryClient.isMutating({ mutationKey: ['tasks'] }) <= 1) {
    await queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }
}

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

const EXPLAINED_CODES: ReadonlySet<string> = new Set(['ALREADY_ADVANCED', 'INVALID_TODAY']);

/** Says which action failed (marking done or reopening) and, without connection, why. */
function explainToggleError(error: unknown, done: boolean): string {
  const code = toAppError(error).code;
  if (EXPLAINED_CODES.has(code)) return taskErrorMessage(error);
  if (code === 'NETWORK') {
    return t(done ? 'tasks.completeFailedOffline' : 'tasks.reopenFailedOffline');
  }
  return t(done ? 'tasks.completeFailed' : 'tasks.reopenFailed');
}

/**
 * The toggle, as the shopping «comprado»: it shows at once, waits for the connection when there is
 * none (`networkMode: 'online'`) and is resent while the request never reached the server. Only a
 * final error rolls this task back and says so. Registered as the defaults of `TOGGLE_KEY`, so a
 * toggle restored from the device after a restart still has its function.
 */
export function buildToggleOptions(
  queryClient: QueryClient,
  notify: (message: string) => void,
): MutationOptions<void, AppError, ToggleVars, Context> {
  return {
    mutationKey: TOGGLE_KEY,
    scope: TASKS_SCOPE,
    networkMode: 'online',
    retry: retryOnNetwork,
    retryDelay: retryDelayOnNetwork,
    // The moment and the day of the tap: the note keeps its time when it arrives, and the server
    // moves a recurring task on from the day it was marked (bloque 11).
    mutationFn: ({ id, done, at }) =>
      done
        ? completeTask(id, localDateIso(at === undefined ? new Date() : new Date(at)), at)
        : reopenTask(id),
    onMutate: async ({ id, done, householdId, userId, at }) => {
      const key = tasksKey(householdId);
      await queryClient.cancelQueries({ queryKey: key });
      const tasks = queryClient.getQueryData<TaskItem[]>(key);
      const previous = tasks?.find((task) => task.id === id);
      const successor = tasks?.find((task) => task.generatedFrom === id);
      const now = at === undefined ? new Date() : new Date(at);
      queryClient.setQueryData<TaskItem[]>(key, (current) =>
        current
          ? applyToggle(current, id, done, userId, now.toISOString(), localDateIso(now))
          : current,
      );
      return { previous, successor };
    },
    // Roll back only this task and its next occurrence: other toggles in flight keep theirs.
    onError: async (error, { id, done, householdId }, context) => {
      const previous = context?.previous;
      const successor = context?.successor;
      // A later toggle of this task still queued (its «Deshacer») already set what it should
      // show: putting back what this one found would undo the undo (fase 10e).
      const later = pendingFor(queryClient, id).length > 1;
      if (previous && !later) {
        queryClient.setQueryData<TaskItem[]>(tasksKey(householdId), (current) => {
          if (!current) return current;
          const restored = current
            .filter((task) => task.generatedFrom !== id)
            .map((task) => (task.id === id ? previous : task));
          return successor ? [...restored, successor] : restored;
        });
      }
      notify(explainToggleError(error, done));
      await invalidateIfStale(queryClient, error);
    },
    onSettled: () => invalidateTasksWhenIdle(queryClient),
  };
}

/** The toggles of this task still pending, oldest first. */
function pendingFor(queryClient: QueryClient, id: string): ToggleVars[] {
  return queryClient
    .getMutationCache()
    .findAll({ mutationKey: TOGGLE_KEY, status: 'pending' })
    .map((m) => m.state.variables as ToggleVars | undefined)
    .filter((vars): vars is ToggleVars => vars?.id === id);
}

/**
 * Runs one toggle. A tap that repeats what is already on its way for this task (a double tap) is
 * dropped; the opposite one, such as «Deshacer» while the complete is still pending, is not: its
 * optimistic update applies at once and its request waits in the task's scope until the earlier
 * one settles. Each toggle keeps its own rollback, as before.
 */
export function runToggle(
  queryClient: QueryClient,
  options: MutationOptions<void, AppError, ToggleVars, Context>,
  vars: ToggleVars,
): void {
  const last = pendingFor(queryClient, vars.id).at(-1);
  if (last !== undefined && last.done === vars.done) return;
  // Completed here: its note lands in the tray with the pin choreography.
  if (vars.done) markFresh(vars.id, 'done');
  // The notice already carries the error (onError): nothing else waits on this promise.
  new MutationObserver(queryClient, options)
    .mutate({ ...vars, at: vars.at ?? new Date().toISOString() })
    .catch(() => undefined);
}
