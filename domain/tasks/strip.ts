import { joinNames } from '@/domain/members/names';
import { t } from '@/i18n';
import { addDays } from './dates';
import { dayHeading } from './labels';
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

/** «Lunes 19, 2 tareas: Brad y Segundo»: what a day cell or row says to a screen reader. */
export function dayCountLabel(
  day: StripDay,
  today: string,
  names: ReadonlyMap<string, string>,
): string {
  const heading = dayHeading(day.date, today);
  const who = joinNames(day.people.flatMap((id) => names.get(id) ?? []));
  if (who === '') {
    return day.count === 1
      ? t('tasks.stripDayOne', { day: heading })
      : t('tasks.stripDay', { day: heading, count: day.count });
  }
  return day.count === 1
    ? t('tasks.stripDayNamedOne', { day: heading, names: who })
    : t('tasks.stripDayNamed', { day: heading, count: day.count, names: who });
}
