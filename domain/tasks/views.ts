import { addDays, localDateIso } from './dates';
import type { RecurrenceRule } from '@/domain/recurrence/rule';
import type { Room } from './rooms';

export type TaskItem = {
  id: string;
  seriesId: string;
  title: string;
  room: Room | null;
  assigneeId: string | null;
  dueOn: string | null;
  completedAt: string | null;
  completedBy: string | null;
  createdBy: string | null;
  createdAt: string;
  recurrence: RecurrenceRule | null;
  skippedAt: string | null;
  generatedFrom: string | null;
};

const WEEK_DAYS = 7;

const isOpen = (t: TaskItem) => t.completedAt === null && t.skippedAt === null;
const isDone = (t: TaskItem) => t.completedAt !== null && t.skippedAt === null;
const byCreatedAt = (a: TaskItem, b: TaskItem) => Date.parse(a.createdAt) - Date.parse(b.createdAt);
// Compare instants numerically: Postgres timestamps vary in fractional digits and offset.
const byDueOn = (a: TaskItem, b: TaskItem) =>
  (a.dueOn ?? '').localeCompare(b.dueOn ?? '') || byCreatedAt(a, b);
const byCompletedDesc = (a: TaskItem, b: TaskItem) =>
  Date.parse(b.completedAt ?? '') - Date.parse(a.completedAt ?? '');

/** Open and due before `today`. */
export function isOverdue(t: TaskItem, today: string): boolean {
  return isOpen(t) && t.dueOn !== null && t.dueOn < today;
}

export function selectToday(
  tasks: TaskItem[],
  today: string,
): { overdue: TaskItem[]; dueToday: TaskItem[]; doneToday: TaskItem[] } {
  return {
    overdue: tasks.filter((t) => isOverdue(t, today)).sort(byDueOn),
    dueToday: tasks.filter((t) => isOpen(t) && t.dueOn === today).sort(byCreatedAt),
    doneToday: tasks
      .filter(
        (t) =>
          t.completedAt !== null &&
          t.skippedAt === null &&
          localDateIso(new Date(t.completedAt)) === today,
      )
      .sort(byCompletedDesc),
  };
}

export function selectWeek(
  tasks: TaskItem[],
  today: string,
): { overdue: TaskItem[]; days: { date: string; tasks: TaskItem[] }[] } {
  const days = Array.from({ length: WEEK_DAYS }, (_, i) => {
    const date = addDays(today, i);
    return { date, tasks: tasks.filter((t) => isOpen(t) && t.dueOn === date).sort(byCreatedAt) };
  });
  return { overdue: tasks.filter((t) => isOverdue(t, today)).sort(byDueOn), days };
}

export function selectAll(
  tasks: TaskItem[],
  // Kept for a uniform view signature; the three groups do not depend on today.
  _today: string,
): { dated: TaskItem[]; undated: TaskItem[]; done: TaskItem[] } {
  return {
    dated: tasks.filter((t) => isOpen(t) && t.dueOn !== null).sort(byDueOn),
    undated: tasks.filter((t) => isOpen(t) && t.dueOn === null).sort(byCreatedAt),
    done: tasks.filter(isDone).sort(byCompletedDesc),
  };
}

/** `null` means the whole household: no filtering. */
export function filterByAssignee(tasks: TaskItem[], assigneeId: string | null): TaskItem[] {
  return assigneeId === null ? tasks : tasks.filter((t) => t.assigneeId === assigneeId);
}
