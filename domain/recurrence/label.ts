import { joinNames } from '@/domain/members/names';
import { t, type MessageKey } from '@/i18n';
import type { IsoWeekday, RecurrenceRule } from './rule';

const weekdayKeys: Record<IsoWeekday, MessageKey> = {
  1: 'weekdays.1',
  2: 'weekdays.2',
  3: 'weekdays.3',
  4: 'weekdays.4',
  5: 'weekdays.5',
  6: 'weekdays.6',
  7: 'weekdays.7',
};

function sameDays(days: IsoWeekday[], expected: IsoWeekday[]): boolean {
  return days.length === expected.length && days.every((d, i) => d === expected[i]);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * A day of the month as the language counts it: "15" in Spanish, "15th" in English. The four
 * forms follow the English ordinal rule; Spanish writes all four the same.
 */
function ordinal(n: number): string {
  const tens = n % 100;
  const key: MessageKey =
    tens >= 11 && tens <= 13
      ? 'ordinal.other'
      : n % 10 === 1
        ? 'ordinal.one'
        : n % 10 === 2
          ? 'ordinal.two'
          : n % 10 === 3
            ? 'ordinal.few'
            : 'ordinal.other';
  return t(key, { n });
}

export function recurrenceLabel(rule: RecurrenceRule): string {
  switch (rule.kind) {
    case 'interval':
      return rule.every === 1 ? t('recurrence.daily') : t('recurrence.everyN', { n: rule.every });
    case 'monthly':
      return rule.day === 31
        ? t('recurrence.monthlyLast')
        : t('recurrence.monthly', { day: ordinal(rule.day) });
    case 'weekly': {
      if (sameDays(rule.days, [1, 2, 3, 4, 5, 6, 7])) return t('recurrence.allDays');
      if (sameDays(rule.days, [1, 2, 3, 4, 5])) return t('recurrence.weekdays');
      if (sameDays(rule.days, [6, 7])) return t('recurrence.weekends');
      const days = joinNames(rule.days.map((d) => t(weekdayKeys[d])));
      return capitalize(t('recurrence.weeklyDays', { days }));
    }
  }
}
