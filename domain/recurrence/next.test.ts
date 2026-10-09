import { describe, expect, it } from 'vitest';
import cases from './recurrence-cases.json';
import { calculateNextOccurrence, firstDueOn } from './next';
import { recurrenceRuleSchema, type RecurrenceRule } from './rule';

const typedCases = cases.map((c) => ({
  ...c,
  rule: recurrenceRuleSchema.parse(c.rule),
}));

describe('calculateNextOccurrence', () => {
  it.each(typedCases)('$name', (c) => {
    expect(calculateNextOccurrence(c.rule, c.dueOn, c.today)).toBe(c.expected);
  });
});

describe('firstDueOn (today = Friday 2026-10-09)', () => {
  it.each<[string, RecurrenceRule, string]>([
    ['interval 3', { kind: 'interval', every: 3 }, '2026-10-09'],
    ['weekly Mon+Thu', { kind: 'weekly', days: [1, 4] }, '2026-10-12'],
    ['weekly Fri', { kind: 'weekly', days: [5] }, '2026-10-09'],
    ['monthly 1', { kind: 'monthly', day: 1 }, '2026-11-01'],
    ['monthly 15', { kind: 'monthly', day: 15 }, '2026-10-15'],
    ['monthly 9', { kind: 'monthly', day: 9 }, '2026-10-09'],
  ])('%s', (_name, rule, expected) => {
    expect(firstDueOn(rule, '2026-10-09')).toBe(expected);
  });
});
