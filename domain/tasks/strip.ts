import { addDays } from './dates';
import { isOpen, type TaskItem } from './views';

export type StripDay = { date: string; people: string[]; unassigned: boolean };

const WEEK_DAYS = 7;

/** Seven days from `today`: who has open tasks each day, in `order` (member join order). */
export function weekStrip(tasks: TaskItem[], today: string, order: readonly string[]): StripDay[] {
  return Array.from({ length: WEEK_DAYS }, (_, i) => {
    const date = addDays(today, i);
    const open = tasks.filter((t) => isOpen(t) && t.dueOn === date);
    const assignees = new Set(open.map((t) => t.assigneeId));
    return {
      date,
      people: order.filter((id) => assignees.has(id)),
      unassigned: assignees.has(null),
    };
  });
}
