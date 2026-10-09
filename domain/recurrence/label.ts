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

function joinNames(names: string[]): string {
  const last = names[names.length - 1] ?? '';
  return names.length === 1 ? last : `${names.slice(0, -1).join(', ')} y ${last}`;
}

export function recurrenceLabel(rule: RecurrenceRule): string {
  switch (rule.kind) {
    case 'interval':
      return rule.every === 1 ? t('recurrence.daily') : t('recurrence.everyN', { n: rule.every });
    case 'monthly':
      return rule.day === 31
        ? t('recurrence.monthlyLast')
        : t('recurrence.monthly', { day: rule.day });
    case 'weekly': {
      if (sameDays(rule.days, [1, 2, 3, 4, 5, 6, 7])) return t('recurrence.allDays');
      if (sameDays(rule.days, [1, 2, 3, 4, 5])) return t('recurrence.weekdays');
      if (sameDays(rule.days, [6, 7])) return t('recurrence.weekends');
      return capitalize(joinNames(rule.days.map((d) => t(weekdayKeys[d]))));
    }
  }
}
