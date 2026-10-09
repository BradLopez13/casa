import { addDays, isoWeekday } from '@/domain/tasks/dates';
import type { RecurrenceRule } from './rule';

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function nextMonthly(day: number, base: string): string {
  const [y = 0, m = 1] = base.split('-').map(Number);
  for (let offset = 0; offset <= 2; offset++) {
    const index = m - 1 + offset;
    const year = y + Math.floor(index / 12);
    const month = (index % 12) + 1;
    const candidate = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(
      Math.min(day, daysInMonth(year, month)),
    ).padStart(2, '0')}`;
    if (candidate > base) return candidate;
  }
  throw new Error('unreachable: a monthly rule always has a date within two months');
}

/**
 * First date of the rule strictly after max(dueOn, today).
 * Dates are YYYY-MM-DD, so string comparison is chronological.
 */
export function calculateNextOccurrence(
  rule: RecurrenceRule,
  dueOn: string,
  today: string,
): string {
  const base = dueOn > today ? dueOn : today;
  switch (rule.kind) {
    case 'interval':
      return addDays(base, rule.every);
    case 'weekly': {
      for (let n = 1; n <= 7; n++) {
        const candidate = addDays(base, n);
        if (rule.days.includes(isoWeekday(candidate))) return candidate;
      }
      throw new Error('weekly rule needs at least one day');
    }
    case 'monthly':
      return nextMonthly(rule.day, base);
  }
}

/** First date of the rule on or after `today`; an interval starts today. */
export function firstDueOn(rule: RecurrenceRule, today: string): string {
  if (rule.kind === 'interval') return today;
  const yesterday = addDays(today, -1);
  return calculateNextOccurrence(rule, yesterday, yesterday);
}
