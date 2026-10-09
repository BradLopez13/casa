import { calculateNextOccurrence } from '@/domain/recurrence/next';
import type { TaskItem } from './views';

const PROVISIONAL_PREFIX = 'provisional:';

/** Id of the next occurrence shown before the server creates the real one. */
export function provisionalId(id: string): string {
  return PROVISIONAL_PREFIX + id;
}

/** Whether the task only exists in the cache, so it must never reach the server. */
export function isProvisional(task: Pick<TaskItem, 'id'>): boolean {
  return task.id.startsWith(PROVISIONAL_PREFIX);
}

/**
 * Returns the list with one task completed or reopened; the others keep their reference.
 * Completing a recurring task appends a provisional next occurrence (unless one already
 * exists); reopening removes the occurrence generated from it.
 */
export function applyToggle(
  tasks: TaskItem[],
  id: string,
  done: boolean,
  userId: string,
  nowIso: string,
  today: string,
): TaskItem[] {
  const target = tasks.find((task) => task.id === id);
  if (!target) return tasks;
  const toggled = tasks.map((task) =>
    task.id === id
      ? { ...task, completedAt: done ? nowIso : null, completedBy: done ? userId : null }
      : task,
  );
  if (!done) return toggled.filter((task) => task.generatedFrom !== id);
  if (target.recurrence === null || tasks.some((task) => task.generatedFrom === id)) {
    return toggled;
  }
  const next: TaskItem = {
    ...target,
    id: provisionalId(id),
    completedAt: null,
    completedBy: null,
    skippedAt: null,
    generatedFrom: id,
    createdAt: nowIso,
    dueOn: calculateNextOccurrence(target.recurrence, target.dueOn ?? today, today),
  };
  return [...toggled, next];
}
