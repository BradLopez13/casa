import type { TaskListSection } from './sections';

/** What is still to do today: it leads, on the left pane or at the top of the single column. */
const PENDING = new Set(['overdue', 'today']);

export type TodayPanes = { left: TaskListSection[]; right: TaskListSection[] };

/**
 * Hoy on two panes: overdue and due today on the left, the tray of what was done today on the
 * right. Each pane keeps the sections' own order, so left then right is the single-column order.
 */
export function todayPanes(sections: TaskListSection[]): TodayPanes {
  return {
    left: sections.filter((section) => PENDING.has(section.key)),
    right: sections.filter((section) => !PENDING.has(section.key)),
  };
}

export type TodayCards = { templates: boolean; invite: boolean };

/**
 * The cards Hoy offers once the tasks have loaded: the templates to a household with no tasks at
 * all (whatever the filter), and the invitation to a household of one with nothing to list.
 */
export function todayCards({
  loaded,
  taskCount,
  memberCount,
  listEmpty,
}: {
  loaded: boolean;
  taskCount: number;
  memberCount: number;
  listEmpty: boolean;
}): TodayCards {
  return {
    templates: loaded && taskCount === 0,
    invite: loaded && listEmpty && memberCount === 1,
  };
}

/** The right pane has nothing to show: no done rows and no card, once the tasks have loaded. */
export function doneEmpty({
  loaded,
  rightCount,
  cards,
}: {
  loaded: boolean;
  rightCount: number;
  cards: TodayCards;
}): boolean {
  return loaded && rightCount === 0 && !cards.templates && !cards.invite;
}
