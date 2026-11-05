import { selectToday, type TaskItem } from './views';

/** What the door of Hoy says. Counts are of tasks still pending today (due today or overdue). */
export type TodayLine =
  | { kind: 'empty' }
  | { kind: 'allDone' }
  /**
   * `today` is what is due today and `overdue` what waits from earlier days, so the door can tell
   * them apart; `household` is what is left for the whole home, or null when the filter is
   * already "Tú".
   */
  | {
      kind: 'mine';
      today: number;
      overdue: number;
      household: number | null;
      /**
       * Whose the household's remainder is, when nothing is due today but yours from earlier days
       * is (bloque 14.5, P2-2): the door then says it.
       */
      rest?: HouseholdRest;
      /**
       * How many were done today, when nothing is due today but yours from earlier days is
       * (bloque 15.3, P3-3): the line then says «Todo hecho por hoy» instead of «Nada para hoy»
       * over the tray of what was done.
       */
      doneToday?: number;
    }
  | { kind: 'household'; household: number }
  | { kind: 'nothingMine'; unassigned: number }
  | { kind: 'person'; name: string; count: number };

/** The household's pending tasks that are not yours: how many unassigned, and each person's. */
export type HouseholdRest = { unassigned: number; others: { id: string; count: number }[] };

type Input = {
  /** Every task of the household, not only the filtered ones. */
  tasks: TaskItem[];
  /**
   * Tasks deleted on screen whose «Deshacer» is still up. They count as they were, neither done
   * nor gone, so the door never celebrates a delete that may yet be undone.
   */
  deleting?: readonly TaskItem[];
  today: string;
  userId: string | null;
  /** The selected member, or null for everyone. */
  filter: string | null;
  /** Display name of the filtered member. */
  filterName: string;
};

export function todayLine({
  tasks,
  deleting = [],
  today,
  userId,
  filter,
  filterName,
}: Input): TodayLine {
  const counted = deleting.length === 0 ? tasks : [...tasks, ...deleting];
  const { overdue, dueToday, doneToday } = selectToday(counted, today);
  const pending = [...overdue, ...dueToday];
  if (pending.length === 0) return doneToday.length > 0 ? { kind: 'allDone' } : { kind: 'empty' };

  const isMine = (task: TaskItem) => task.assigneeId === userId && userId !== null;
  const mineToday = dueToday.filter(isMine).length;
  const mineOverdue = overdue.filter(isMine).length;
  const mine = mineToday + mineOverdue;
  if (filter === null) {
    if (mine === 0) return { kind: 'household', household: pending.length };
    const line = {
      kind: 'mine' as const,
      today: mineToday,
      overdue: mineOverdue,
      household: pending.length - mine,
    };
    return mineToday > 0
      ? line
      : {
          ...line,
          rest: householdRest(pending.filter((t) => !isMine(t))),
          doneToday: doneToday.length,
        };
  }
  if (filter === userId) {
    if (mine > 0) {
      const line = {
        kind: 'mine' as const,
        today: mineToday,
        overdue: mineOverdue,
        household: null,
      };
      return mineToday > 0 ? line : { ...line, doneToday: doneToday.length };
    }
    return { kind: 'nothingMine', unassigned: pending.filter((t) => t.assigneeId === null).length };
  }
  return {
    kind: 'person',
    name: filterName,
    count: pending.filter((task) => task.assigneeId === filter).length,
  };
}

function householdRest(tasks: readonly TaskItem[]): HouseholdRest {
  const counts = new Map<string, number>();
  let unassigned = 0;
  for (const task of tasks) {
    if (task.assigneeId === null) unassigned += 1;
    else counts.set(task.assigneeId, (counts.get(task.assigneeId) ?? 0) + 1);
  }
  return { unassigned, others: [...counts].map(([id, count]) => ({ id, count })) };
}
