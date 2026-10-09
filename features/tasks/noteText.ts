import { recurrenceLabel } from '@/domain/recurrence/label';
import { dueLabel, overdueLabel } from '@/domain/tasks/labels';
import { isOverdue, type TaskItem } from '@/domain/tasks/views';
import { t } from '@/i18n';

export type NoteText = {
  room: string | null;
  due: string;
  overdue: boolean;
  repeat: string | null;
  /** What a screen reader says for the note body (the magnet is hidden from it). */
  label: string;
};

/** The words a task note shows and announces, kept apart from the component so they can be tested. */
export function noteText(
  task: TaskItem,
  today: string,
  assigneeName: string | undefined,
): NoteText {
  const overdue = isOverdue(task, today);
  const room = task.room ? t(`rooms.${task.room}`) : null;
  const due = overdue && task.dueOn ? overdueLabel(task.dueOn, today) : dueLabel(task.dueOn, today);
  const repeat = task.recurrence ? recurrenceLabel(task.recurrence) : null;
  const label = [task.title, assigneeName ?? t('tasks.a11y.unassigned'), room, due, repeat]
    .filter((part) => part !== null)
    .join(', ');
  return { room, due, overdue, repeat, label };
}
