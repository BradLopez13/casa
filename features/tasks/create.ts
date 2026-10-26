import type { MutationOptions, QueryClient } from '@tanstack/react-query';
import { retryDelayOnNetwork, retryOnNetwork } from '@/data/query/retry';
import type { AppError } from '@/data/supabase/errors';
import type { TaskInput } from '@/domain/tasks/input';
import type { TaskItem } from '@/domain/tasks/views';
import { createTask } from './api';
import { taskErrorMessage } from './errors';
import { tasksKey } from './keys';
import { invalidateIfStale, invalidateTasksWhenIdle, TASKS_SCOPE } from './toggle';

export const CREATE_KEY = ['tasks', 'create'] as const;

/** A new task, with the id the app gave it: resending it after a restart makes the same task. */
export type CreateVars = {
  id: string;
  householdId: string;
  userId: string | null;
  input: TaskInput;
};
type Context = { added: boolean };

/** The note as the person wrote it, until the server's comes back with the refetch. */
export function draftItem({ id, userId, input }: CreateVars, at = new Date()): TaskItem {
  return {
    id,
    seriesId: id,
    title: input.title,
    room: input.room,
    assigneeId: input.assigneeId,
    dueOn: input.dueOn,
    completedAt: null,
    completedBy: null,
    recurrence: input.recurrence,
    skippedAt: null,
    generatedFrom: null,
    createdBy: userId,
    createdAt: at.toISOString(),
  };
}

/**
 * Creating a task from the quick add, as the shopping «añadir» (fase 10e, decisión de Brad): the
 * note shows at once, the request waits for the connection when there is none and is resent while
 * it never reached the server. It shares the tasks' queue, so completing a task still on its way
 * goes after it. Only a final error takes the note out and says so.
 */
export function buildCreateOptions(
  queryClient: QueryClient,
  notify: (message: string) => void,
): MutationOptions<string, AppError, CreateVars, Context> {
  return {
    mutationKey: CREATE_KEY,
    scope: TASKS_SCOPE,
    networkMode: 'online',
    retry: retryOnNetwork,
    retryDelay: retryDelayOnNetwork,
    mutationFn: ({ id, householdId, input }) => createTask(id, householdId, input),
    onMutate: async (vars) => {
      const key = tasksKey(vars.householdId);
      await queryClient.cancelQueries({ queryKey: key });
      let added = false;
      queryClient.setQueryData<TaskItem[]>(key, (current) => {
        if (!current || current.some((task) => task.id === vars.id)) return current;
        added = true;
        return [...current, draftItem(vars)];
      });
      return { added };
    },
    // A new id is never on the server before its create: the note goes, also for a create
    // restored after a restart, which has no context.
    onError: async (error, { id, householdId }) => {
      queryClient.setQueryData<TaskItem[]>(tasksKey(householdId), (current) =>
        current?.filter((task) => task.id !== id),
      );
      notify(taskErrorMessage(error));
      await invalidateIfStale(queryClient, error);
    },
    onSettled: () => invalidateTasksWhenIdle(queryClient),
  };
}
