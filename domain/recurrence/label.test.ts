import { afterAll, describe, expect, it, vi } from 'vitest';
import { recurrenceLabel } from './label';
import type { RecurrenceRule } from './rule';

const cases: [string, RecurrenceRule, string][] = [
  ['interval 1', { kind: 'interval', every: 1 }, 'Cada día'],
  ['interval 3', { kind: 'interval', every: 3 }, 'Cada 3 días'],
  ['weekly two days', { kind: 'weekly', days: [1, 4] }, 'Lunes y jueves'],
  ['weekly three days', { kind: 'weekly', days: [1, 3, 5] }, 'Lunes, miércoles y viernes'],
  ['weekly one day', { kind: 'weekly', days: [2] }, 'Martes'],
  ['weekdays', { kind: 'weekly', days: [1, 2, 3, 4, 5] }, 'De lunes a viernes'],
  ['weekend', { kind: 'weekly', days: [6, 7] }, 'Fines de semana'],
  ['every day', { kind: 'weekly', days: [1, 2, 3, 4, 5, 6, 7] }, 'Todos los días'],
  ['monthly 9', { kind: 'monthly', day: 9 }, 'El día 9 de cada mes'],
  ['monthly 31', { kind: 'monthly', day: 31 }, 'El último día de cada mes'],
];

describe('recurrenceLabel', () => {
  it.each(cases)('%s', (_name, rule, label) => {
    expect(recurrenceLabel(rule)).toBe(label);
  });
});

describe('recurrenceLabel on an English phone', () => {
  const englishCases: [string, RecurrenceRule, string][] = [
    ['interval 1', { kind: 'interval', every: 1 }, 'Every day'],
    ['interval 3', { kind: 'interval', every: 3 }, 'Every 3 days'],
    ['weekly one day', { kind: 'weekly', days: [1] }, 'Every Monday'],
    ['weekly two days', { kind: 'weekly', days: [1, 4] }, 'Every Monday and Thursday'],
    [
      'weekly three days',
      { kind: 'weekly', days: [1, 3, 5] },
      'Every Monday, Wednesday and Friday',
    ],
    ['weekdays', { kind: 'weekly', days: [1, 2, 3, 4, 5] }, 'Weekdays'],
    ['weekend', { kind: 'weekly', days: [6, 7] }, 'Weekends'],
    ['monthly 1', { kind: 'monthly', day: 1 }, 'Every month on the 1st'],
    ['monthly 2', { kind: 'monthly', day: 2 }, 'Every month on the 2nd'],
    ['monthly 3', { kind: 'monthly', day: 3 }, 'Every month on the 3rd'],
    ['monthly 11', { kind: 'monthly', day: 11 }, 'Every month on the 11th'],
    ['monthly 15', { kind: 'monthly', day: 15 }, 'Every month on the 15th'],
    ['monthly 22', { kind: 'monthly', day: 22 }, 'Every month on the 22nd'],
    ['monthly 31', { kind: 'monthly', day: 31 }, 'The last day of every month'],
  ];

  afterAll(() => {
    vi.doUnmock('expo-localization');
    vi.resetModules();
  });

  it.each(englishCases)('%s', async (_name, rule, label) => {
    vi.resetModules();
    vi.doMock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));
    const english = await import('./label');
    expect(english.recurrenceLabel(rule)).toBe(label);
  });
});
