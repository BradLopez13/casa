import { dayHeading } from '@/domain/tasks/labels';
import type { TaskListSection } from './sections';

/**
 * The day Semana shows on its right pane: the one the person chose while it is still in the
 * week, otherwise today (the week moves on at midnight and a past choice falls out of it).
 */
export function chosenDay(
  days: readonly { date: string }[],
  chosen: string | null,
  today: string,
): string {
  return chosen !== null && days.some((day) => day.date === chosen) ? chosen : today;
}

export type WeekDayPane = { overdue: TaskListSection | null; day: TaskListSection };

/**
 * Semana's right pane on a wide screen: what is overdue, which stays in view whatever the day
 * (it leads the single column too), then the chosen day. A day with nothing on it still gets its
 * heading, with a count of 0, so the pane always says which day it is showing.
 */
export function weekDayPane(
  sections: readonly TaskListSection[],
  day: string,
  today: string,
): WeekDayPane {
  return {
    overdue: sections.find((section) => section.key === 'overdue') ?? null,
    day: sections.find((section) => section.key === day) ?? {
      key: day,
      title: dayHeading(day, today),
      count: 0,
      data: [],
    },
  };
}
