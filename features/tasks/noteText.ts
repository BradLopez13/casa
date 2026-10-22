import { recurrenceLabel } from '@/domain/recurrence/label';
import { dueLabel, overdueLabel } from '@/domain/tasks/labels';
import { isOverdue, type TaskItem } from '@/domain/tasks/views';
import { t } from '@/i18n';

export type NoteText = {
  room: string | null;
  due: string;
  overdue: boolean;
  repeat: string | null;
  /** What a screen reader says for the note body. */
  label: string;
  /**
   * What the magnet says, «de Ana», when someone has the task: a short stop of its own before the
   * note (fase 10d). With nobody, the magnet stays hidden and the note says «Sin responsable».
   */
  owner: string | null;
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
  const owner = assigneeName === undefined ? null : t('tasks.a11y.owner', { name: assigneeName });
  const label = [task.title, owner === null ? t('tasks.a11y.unassigned') : null, room, due, repeat]
    .filter((part) => part !== null)
    .join(', ');
  return { room, due, overdue, repeat, label, owner };
}
