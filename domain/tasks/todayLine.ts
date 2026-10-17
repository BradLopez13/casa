import { selectToday, type TaskItem } from './views';

/** What the door of Hoy says. Counts are of tasks still pending today (due today or overdue). */
export type TodayLine =
  | { kind: 'empty' }
  | { kind: 'allDone' }
  /** `household` is what is left for the whole home, or null when the filter is already "Tú". */
  | { kind: 'mine'; count: number; household: number | null }
  | { kind: 'household'; household: number }
  | { kind: 'nothingMine'; unassigned: number }
  | { kind: 'person'; name: string; count: number };

type Input = {
  /** Every task of the household, not only the filtered ones. */
  tasks: TaskItem[];
  today: string;
  userId: string | null;
  /** The selected member, or null for everyone. */
  filter: string | null;
  /** Display name of the filtered member. */
  filterName: string;
};

export function todayLine({ tasks, today, userId, filter, filterName }: Input): TodayLine {
  const { overdue, dueToday, doneToday } = selectToday(tasks, today);
  const pending = [...overdue, ...dueToday];
  if (pending.length === 0) return doneToday.length > 0 ? { kind: 'allDone' } : { kind: 'empty' };

  const mine = pending.filter((task) => task.assigneeId === userId && userId !== null).length;
  if (filter === null) {
    return mine > 0
      ? { kind: 'mine', count: mine, household: pending.length - mine }
      : { kind: 'household', household: pending.length };
  }
  if (filter === userId) {
    if (mine > 0) return { kind: 'mine', count: mine, household: null };
    return { kind: 'nothingMine', unassigned: pending.filter((t) => t.assigneeId === null).length };
  }
  return {
    kind: 'person',
    name: filterName,
    count: pending.filter((task) => task.assigneeId === filter).length,
  };
}
