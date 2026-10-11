import { calculateNextOccurrence } from '@/domain/recurrence/next';
import { addDays } from '@/domain/tasks/dates';
import { isOpen, selectToday, type TaskItem } from '@/domain/tasks/views';
import type { ReminderSettings } from './settings';

export type Reminder = {
  id: string;
  fireAt: Date;
  kind: 'morning' | 'evening';
  /** YYYY-MM-DD the reminder is about. */
  date: string;
  count: number;
  overdue: number;
  titles: string[];
};

const MAX_TITLES = 3;

/**
 * Adds the future occurrences of each recurring series that the cache does not hold yet,
 * within [today, end). Projection starts only from open occurrences inside the window: an
 * overdue one (dueOn < today) counts just in today's morning and is never projected from,
 * which keeps the projection simple and avoids guessing when it will be done.
 */
function withProjections(tasks: TaskItem[], today: string, end: string): TaskItem[] {
  const known = new Set(tasks.map((t) => `${t.seriesId}|${t.dueOn ?? ''}`));
  const projected: TaskItem[] = [];
  for (const t of tasks) {
    if (!t.recurrence || !isOpen(t) || t.dueOn === null) continue;
    if (t.dueOn < today || t.dueOn >= end) continue;
    let date = calculateNextOccurrence(t.recurrence, t.dueOn, t.dueOn);
    while (date < end) {
      const key = `${t.seriesId}|${date}`;
      if (!known.has(key)) {
        known.add(key);
        projected.push({ ...t, id: `${t.id}@${date}`, dueOn: date, generatedFrom: t.id });
      }
      date = calculateNextOccurrence(t.recurrence, date, date);
    }
  }
  return [...tasks, ...projected];
}

function fireAt(date: string, time: string): Date {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
  const [hh = 0, mm = 0] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

export function scheduleReminders(input: {
  tasks: TaskItem[];
  userId: string;
  today: string;
  now: Date;
  settings: ReminderSettings;
  days: number;
}): Reminder[] {
  const { userId, today, now, settings, days } = input;
  if (!settings.enabled) return [];

  const end = addDays(today, days);
  const mine = withProjections(input.tasks, today, end).filter(
    (t) => t.assigneeId === userId || t.assigneeId === null,
  );

  const reminders: Reminder[] = [];
  const add = (kind: Reminder['kind'], date: string, items: TaskItem[], overdue: number) => {
    if (items.length === 0) return;
    const at = fireAt(date, kind === 'morning' ? settings.morning : settings.evening);
    if (at.getTime() <= now.getTime()) return;
    reminders.push({
      id: `${kind}-${date}`,
      fireAt: at,
      kind,
      date,
      count: items.length,
      overdue,
      titles: items.slice(0, MAX_TITLES).map((t) => t.title),
    });
  };

  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    // Same grouping and order as the Hoy view for that date.
    const view = selectToday(mine, date);
    const overdue = i === 0 ? view.overdue : [];
    add('morning', date, [...overdue, ...view.dueToday], overdue.length);
    add('evening', date, view.dueToday, 0);
  }
  return reminders;
}
