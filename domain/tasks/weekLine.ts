import { isOpen, type TaskItem } from './views';

/**
 * What the door of Tareas says under «Todas las tareas»: the same reading as Hoy's line (§2.3),
 * over every open task, dated or not.
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

/** What the door says in Todas: the same reading over every open task, dated or not. */
export function allLine({ tasks, userId, filter, filterName }: Input): WeekLine {
  return lineFor(tasks.filter(isOpen), userId, filter, filterName);
}

function lineFor(
  pending: TaskItem[],
  userId: string | null,
  filter: string | null,
  filterName: string,
): WeekLine {
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
