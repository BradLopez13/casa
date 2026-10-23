import { locale, t } from '@/i18n';
import { addDays, daysBetween, localDateIso, toLocalDate } from './dates';

/** Human label for a due date: relative for yesterday..tomorrow, else a long local date. */
export function dueLabel(dueOn: string | null, today: string): string {
  if (dueOn === null) return t('tasks.due.none');
  if (dueOn === today) return t('tasks.due.today');
  if (dueOn === addDays(today, 1)) return t('tasks.due.tomorrow');
  if (dueOn === addDays(today, -1)) return t('tasks.due.yesterday');
  return longDateLabel(dueOn);
}

/**
 * The date on the task sheet's magnet: as `dueLabel`, and a date before yesterday says it went by
 * («domingo, 18 de octubre · pasada»), as the note in the list says «Pendiente desde» (fase 10a).
 */
export function dueChipLabel(dueOn: string | null, today: string): string {
  if (dueOn === null || dueOn >= addDays(today, -1)) return dueLabel(dueOn, today);
  return t('tasks.due.past', { date: longDateLabel(dueOn) });
}

/** "jueves, 9 de octubre" / "Thursday, October 9". */
export function longDateLabel(iso: string): string {
  return toLocalDate(iso).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** What a screen reader says for a day cell of the form: the whole date, today named first. */
export function dayCellLabel(iso: string, today: string): string {
  const date = longDateLabel(iso);
  return iso === today ? `${t('tasks.due.today')}, ${date}` : date;
}

/**
 * "sábado 11" / "Saturday 11": the weekday from Intl, the order from the strings (Intl in en-US
 * would say "11 Saturday").
 */
export function weekdayDay(iso: string, weekday: 'long' | 'short' = 'long'): string {
  const date = toLocalDate(iso);
  return t('dates.weekdayDay', {
    weekday: date.toLocaleDateString(locale, { weekday }),
    day: date.getDate(),
  });
}

/** Why a task is late: yesterday, weekday + day within the week, else day + month. */
export function overdueLabel(dueOn: string, today: string): string {
  const late = daysBetween(dueOn, today);
  if (late <= 1) return t('tasks.overdue.yesterday');
  const date =
    late < 7
      ? weekdayDay(dueOn)
      : toLocalDate(dueOn).toLocaleDateString(locale, { day: 'numeric', month: 'long' });
  return t('tasks.overdue.on', { date });
}

/** Day heading for the week view: "Hoy", "Mañana" or "sábado 11". */
export function dayHeading(date: string, today: string): string {
  if (date === today) return t('tasks.due.today');
  if (date === addDays(today, 1)) return t('tasks.due.tomorrow');
  return weekdayDay(date);
}

/**
 * The day heading inside a sentence: "mañana" / "tomorrow" in lower case, a weekday as the
 * language writes it ("sábado 11" / "Saturday 11").
 */
export function dayInSentence(date: string, today: string): string {
  const heading = dayHeading(date, today);
  return date === today || date === addDays(today, 1) ? heading.toLocaleLowerCase(locale) : heading;
}

/**
 * "Hoy", "Mañana", else the weekday alone ("Domingo"), capitalised like the other two: for a row
 * that shows the day number apart.
 */
export function dayName(date: string, today: string): string {
  if (date === today) return t('tasks.due.today');
  if (date === addDays(today, 1)) return t('tasks.due.tomorrow');
  const weekday = toLocalDate(date).toLocaleDateString(locale, { weekday: 'long' });
  return weekday.charAt(0).toLocaleUpperCase(locale) + weekday.slice(1);
}

/** Notice after skipping a repeat: "Saltada. Vuelve mañana." or "Saltada. Vuelve el sábado 11." */
export function skippedNotice(next: string, today: string): string {
  const day = dayInSentence(next, today);
  return next <= addDays(today, 1)
    ? t('tasks.skippedSoon', { day })
    : t('tasks.skipped', { date: day });
}

/**
 * When a done task was done, without naming anyone (its magnet says who): "10:42" today,
 * "ayer, 18:05", else "2 oct, 9:00". The clock follows the locale (24 h or a.m./p.m.).
 */
export function doneWhen(completedAt: string, today: string): string {
  const when = new Date(completedAt);
  const time = when.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  const day = localDateIso(when);
  if (day === today) return time;
  if (day === addDays(today, -1)) return t('tasks.doneWhen.yesterday', { time });
  const date = when.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  return t('tasks.doneWhen.on', { date: date.replace(/\.$/, ''), time });
}
