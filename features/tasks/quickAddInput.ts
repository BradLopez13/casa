import type { TaskInput } from '@/domain/tasks/input';

/**
 * What the quick-add field creates from what was typed: a plain task for that person and day.
 * Null when there is nothing to add. The single entry point for the field's text.
 */
export function quickAddInput(
  text: string,
  assigneeId: string | null,
  dueOn: string,
): TaskInput | null {
  const title = text.trim();
  if (title === '') return null;
  return { title, room: null, assigneeId, dueOn, recurrence: null };
}
