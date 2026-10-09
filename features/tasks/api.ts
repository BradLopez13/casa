import * as Crypto from 'expo-crypto';
import type { Json } from '@/data/supabase/database.types';
import { supabase } from '@/data/supabase/client';
import { AppError, toAppError } from '@/data/supabase/errors';
import { recurrenceRuleSchema, type RecurrenceRule } from '@/domain/recurrence/rule';
import type { Room } from '@/domain/tasks/rooms';
import type { TaskItem } from '@/domain/tasks/views';

export type TaskInput = {
  title: string;
  room: Room | null;
  assigneeId: string | null;
  dueOn: string | null;
  recurrence: RecurrenceRule | null;
};

type Result<D> = PromiseLike<{ data: D; error: unknown }>;

/** Resolves with the data (possibly null), or throws an AppError. */
async function unwrapMaybe<D>(promise: Result<D>): Promise<D> {
  let result;
  try {
    result = await promise;
  } catch (e) {
    throw toAppError(e);
  }
  if (result.error) throw toAppError(result.error);
  return result.data;
}

/** Like unwrapMaybe, but a null result is an error. */
async function unwrap<D>(promise: Result<D>): Promise<NonNullable<D>> {
  const data = await unwrapMaybe(promise);
  if (data === null || data === undefined) throw new AppError('UNKNOWN');
  return data;
}

export const newTaskId = (): string => Crypto.randomUUID();

/** An unreadable stored rule degrades to a non-recurring task. */
function parseRule(raw: unknown): RecurrenceRule | null {
  const parsed = recurrenceRuleSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Open tasks plus those completed since `since` (ISO instant). */
export async function listTasks(householdId: string, since: string): Promise<TaskItem[]> {
  const data = await unwrap(
    supabase
      .from('task_occurrences')
      .select(
        'id, due_on, assignee_id, completed_at, completed_by, created_at, series_id, skipped_at, generated_from, task_series(title, room, created_by, recurrence_rule)',
      )
      .eq('household_id', householdId)
      .or(`and(completed_at.is.null,skipped_at.is.null),completed_at.gte.${since}`),
  );
  return data.map((row) => ({
    id: row.id,
    seriesId: row.series_id,
    title: row.task_series?.title ?? '',
    room: (row.task_series?.room ?? null) as Room | null,
    assigneeId: row.assignee_id,
    dueOn: row.due_on,
    // Postgres returns variable fractional digits; normalise so they compare as instants.
    completedAt: row.completed_at === null ? null : new Date(row.completed_at).toISOString(),
    completedBy: row.completed_by,
    createdBy: row.task_series?.created_by ?? null,
    createdAt: new Date(row.created_at).toISOString(),
    recurrence: parseRule(row.task_series?.recurrence_rule),
    skippedAt: row.skipped_at === null ? null : new Date(row.skipped_at).toISOString(),
    generatedFrom: row.generated_from,
  }));
}

// The generated RPC types declare nullable args as plain string; the functions accept null.
const nullable = (value: string | null) => value as string;

export async function createTask(
  id: string,
  householdId: string,
  input: TaskInput,
): Promise<string> {
  return unwrap(
    supabase.rpc('create_task', {
      p_id: id,
      p_household_id: householdId,
      p_title: input.title,
      p_room: nullable(input.room),
      p_assignee_id: nullable(input.assigneeId),
      p_due_on: nullable(input.dueOn),
      p_recurrence: input.recurrence as Json,
    }),
  );
}

export async function updateTask(id: string, input: TaskInput): Promise<void> {
  await unwrapMaybe(
    supabase.rpc('update_task', {
      p_id: id,
      p_title: input.title,
      p_room: nullable(input.room),
      p_assignee_id: nullable(input.assigneeId),
      p_due_on: nullable(input.dueOn),
      p_recurrence: input.recurrence as Json,
    }),
  );
}

export async function deleteTask(id: string): Promise<void> {
  await unwrapMaybe(supabase.rpc('delete_task', { p_id: id }));
}

export async function completeTask(id: string, today: string): Promise<void> {
  await unwrapMaybe(supabase.rpc('complete_task', { p_id: id, p_today: today }));
}

export async function skipTask(id: string, today: string): Promise<void> {
  await unwrapMaybe(supabase.rpc('skip_task', { p_id: id, p_today: today }));
}

export async function reopenTask(id: string): Promise<void> {
  await unwrapMaybe(supabase.rpc('reopen_task', { p_id: id }));
}
