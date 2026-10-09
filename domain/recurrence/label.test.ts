import { describe, expect, it } from 'vitest';
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
