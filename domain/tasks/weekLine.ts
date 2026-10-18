import { selectWeek, type TaskItem } from './views';

/**
 * What the door of Tareas says under «Esta semana»: the same reading as Hoy's line (§2.3), over
 * the seven days from today plus what is overdue. Counts are of open tasks only.
 */
export type WeekLine =
  | { kind: 'empty' }
  | { kind: 'mine'; count: number }
  | { kind: 'household'; household: number }
  | { kind: 'nothingMine' }
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

export function weekLine({ tasks, today, userId, filter, filterName }: Input): WeekLine {
  const { overdue, days } = selectWeek(tasks, today);
  const pending = [...overdue, ...days.flatMap((d) => d.tasks)];
  const mine = pending.filter((task) => userId !== null && task.assigneeId === userId).length;

  if (filter !== null && filter !== userId) {
    return {
      kind: 'person',
      name: filterName,
      count: pending.filter((task) => task.assigneeId === filter).length,
    };
  }
  if (pending.length === 0) return { kind: 'empty' };
  if (mine > 0) return { kind: 'mine', count: mine };
  return filter === null
    ? { kind: 'household', household: pending.length }
    : { kind: 'nothingMine' };
}
