import { isoWeekday } from '@/domain/tasks/dates';
import type { RecurrenceRule } from './rule';

/** The options of the "Se repite" row. */
export type RepeatChoice = 'none' | 'daily' | 'weekly' | 'interval' | 'monthly';

export function choiceOf(rule: RecurrenceRule | null): RepeatChoice {
  if (rule === null) return 'none';
  if (rule.kind === 'interval') return rule.every === 1 ? 'daily' : 'interval';
  return rule.kind;
}

function dayOfMonth(dueOn: string): number {
  return Number(dueOn.slice(8, 10));
}

/** The rule a choice starts with, anchored on the task's date. */
export function ruleForChoice(choice: RepeatChoice, dueOn: string): RecurrenceRule | null {
  switch (choice) {
    case 'none':
      return null;
    case 'daily':
      return { kind: 'interval', every: 1 };
    case 'interval':
      return { kind: 'interval', every: 2 };
    case 'weekly':
      return { kind: 'weekly', days: [isoWeekday(dueOn)] };
    case 'monthly':
      return { kind: 'monthly', day: dayOfMonth(dueOn) };
  }
}

function lastDayOfMonth(dueOn: string): number {
  const [y = 0, m = 1] = dueOn.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * A monthly rule follows the day of the date; any other rule stays as it is. A date on the
 * rule's own day, clamped to that month (the 30th of November for day 31), keeps the rule.
 */
export function syncMonthly(
  rule: RecurrenceRule | null,
  dueOn: string | null,
): RecurrenceRule | null {
  if (rule?.kind !== 'monthly' || dueOn === null) return rule;
  const day = dayOfMonth(dueOn);
  if (day === Math.min(rule.day, lastDayOfMonth(dueOn))) return rule;
  return { kind: 'monthly', day };
}
