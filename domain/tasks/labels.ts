import { locale, t } from '@/i18n';
import { addDays, daysBetween, toLocalDate } from './dates';

/** Human label for a due date: relative for yesterday..tomorrow, else a long local date. */
export function dueLabel(dueOn: string | null, today: string): string {
  if (dueOn === null) return t('tasks.due.none');
  if (dueOn === today) return t('tasks.due.today');
  if (dueOn === addDays(today, 1)) return t('tasks.due.tomorrow');
  if (dueOn === addDays(today, -1)) return t('tasks.due.yesterday');
  return longDateLabel(dueOn);
}

/** "jueves, 9 de octubre". */
export function longDateLabel(iso: string): string {
  return toLocalDate(iso).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** Why a task is late: yesterday, weekday + day within the week, else day + month. */
export function overdueLabel(dueOn: string, today: string): string {
  const late = daysBetween(dueOn, today);
  if (late <= 1) return t('tasks.overdue.yesterday');
  const date =
    late < 7
      ? toLocalDate(dueOn).toLocaleDateString(locale, { weekday: 'long', day: 'numeric' })
      : toLocalDate(dueOn).toLocaleDateString(locale, { day: 'numeric', month: 'long' });
  return t('tasks.overdue.on', { date });
}

/** Day heading for the week view: "Hoy", "Mañana" or "sábado 11". */
export function dayHeading(date: string, today: string): string {
  if (date === today) return t('tasks.due.today');
  if (date === addDays(today, 1)) return t('tasks.due.tomorrow');
  return toLocalDate(date).toLocaleDateString(locale, { weekday: 'long', day: 'numeric' });
}
