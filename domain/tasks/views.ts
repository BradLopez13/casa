import { addDays, localDateIso } from './dates';
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
};

const WEEK_DAYS = 7;

const isOpen = (t: TaskItem) => t.completedAt === null;
const byCreatedAt = (a: TaskItem, b: TaskItem) => a.createdAt.localeCompare(b.createdAt);
const byDueOn = (a: TaskItem, b: TaskItem) =>
  (a.dueOn ?? '').localeCompare(b.dueOn ?? '') || byCreatedAt(a, b);
// ISO instants share one format, so a plain comparison orders them in time.
const byCompletedDesc = (a: TaskItem, b: TaskItem) =>
  (b.completedAt ?? '').localeCompare(a.completedAt ?? '');

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
      .filter((t) => t.completedAt !== null && localDateIso(new Date(t.completedAt)) === today)
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
    done: tasks.filter((t) => !isOpen(t)).sort(byCompletedDesc),
  };
}

export function filterMine(tasks: TaskItem[], userId: string): TaskItem[] {
  return tasks.filter((t) => t.assigneeId === userId);
}
