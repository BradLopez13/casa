import { addDays } from '@/domain/tasks/dates';
import { dayHeading, dayInSentence, weekdayDay } from '@/domain/tasks/labels';
import type { StripDay } from '@/domain/tasks/strip';
import { isOpen, type TaskItem } from '@/domain/tasks/views';
import { t } from '@/i18n';
import type { TaskListSection } from './sections';

/** One pill of the row under the quick add of Tareas: «Todas» (`date` null) or one of the week's days. */
export type DayPill = { date: string | null; label: string };

/** «Todas», then the seven days: «Hoy», «Mañana», and after that «mié 22». */
export function dayPills(days: readonly StripDay[], today: string): DayPill[] {
  return [
    { date: null, label: t('tasks.pill.all') },
    ...days.map((day) => ({ date: day.date, label: pillLabel(day.date, today) })),
  ];
}

function pillLabel(date: string, today: string): string {
  if (date === today) return t('tasks.due.today');
  if (date === addDays(today, 1)) return t('tasks.due.tomorrow');
  return weekdayDay(date, 'short');
}

/**
 * The pill the list is filtered by: the chosen day while it is still in the week, else «Todas»
 * (the week moves on at midnight and a past choice falls out of it).
 */
export function chosenPill(
  days: readonly { date: string }[],
  chosen: string | null,
): string | null {
  return chosen !== null && days.some((day) => day.date === chosen) ? chosen : null;
}

/** The list filtered by a day: one section, keyed by the date, with the open tasks due then. */
export function daySections(tasks: TaskItem[], day: string, today: string): TaskListSection[] {
  const due = tasks.filter((task) => isOpen(task) && task.dueOn === day);
  if (due.length === 0) return [];
  return [
    {
      key: day,
      title: dayHeading(day, today),
      count: due.length,
      data: due.map((task) => ({ kind: 'note', task })),
    },
  ];
}

/** A chosen day with nothing on it says so by name, in one line: the quick add is right above. */
export function emptyDayText(day: string, today: string): string {
  if (day === today) return t('tasks.dayEmptyToday');
  if (day === addDays(today, 1)) return t('tasks.dayEmptyTomorrow');
  return t('tasks.dayEmptyNamed', { day: dayInSentence(day, today) });
}
