import { addDays } from './dates';
import { isOpen, type TaskItem } from './views';

/** `count` is the number of open tasks due that day: the same ones the week list shows. */
export type StripDay = { date: string; people: string[]; unassigned: boolean; count: number };

const WEEK_DAYS = 7;

/** Seven days from `today`: how many open tasks each day has and who has them, in `order`. */
export function weekStrip(tasks: TaskItem[], today: string, order: readonly string[]): StripDay[] {
  return Array.from({ length: WEEK_DAYS }, (_, i) => {
    const date = addDays(today, i);
    const open = tasks.filter((t) => isOpen(t) && t.dueOn === date);
    const assignees = new Set(open.map((t) => t.assigneeId));
    return {
      date,
      people: order.filter((id) => assignees.has(id)),
      unassigned: assignees.has(null),
      count: open.length,
    };
  });
}
