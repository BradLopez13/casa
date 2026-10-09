import { describe, expect, it } from 'vitest';
import { recurrenceRuleSchema } from './rule';

describe('recurrenceRuleSchema', () => {
  it.each([
    { kind: 'interval', every: 1 },
    { kind: 'interval', every: 365 },
    { kind: 'weekly', days: [1] },
    { kind: 'weekly', days: [1, 2, 3, 4, 5, 6, 7] },
    { kind: 'monthly', day: 1 },
    { kind: 'monthly', day: 31 },
  ])('accepts %j', (rule) => {
    expect(recurrenceRuleSchema.safeParse(rule).success).toBe(true);
  });

  it.each([
    { kind: 'interval', every: 0 },
    { kind: 'interval', every: 366 },
    { kind: 'interval', every: 1.5 },
    { kind: 'weekly', days: [] },
    { kind: 'weekly', days: [4, 1] },
    { kind: 'weekly', days: [1, 1] },
    { kind: 'weekly', days: [8] },
    { kind: 'monthly', day: 0 },
    { kind: 'monthly', day: 32 },
    { kind: 'yearly' },
    { kind: 'interval', every: 2, extra: 1 },
  ])('rejects %j', (rule) => {
    expect(recurrenceRuleSchema.safeParse(rule).success).toBe(false);
  });
});
