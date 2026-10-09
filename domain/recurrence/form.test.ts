import { describe, expect, it } from 'vitest';
import { choiceOf, ruleForChoice, syncMonthly } from './form';
import type { RecurrenceRule } from './rule';

describe('choiceOf', () => {
  it('is none without a rule', () => {
    expect(choiceOf(null)).toBe('none');
  });

  it('reads an interval of 1 as daily', () => {
    expect(choiceOf({ kind: 'interval', every: 1 })).toBe('daily');
  });

  it('reads a longer interval as interval', () => {
    expect(choiceOf({ kind: 'interval', every: 4 })).toBe('interval');
  });

  it('reads weekly and monthly as themselves', () => {
    expect(choiceOf({ kind: 'weekly', days: [1] })).toBe('weekly');
    expect(choiceOf({ kind: 'monthly', day: 9 })).toBe('monthly');
  });
});

describe('ruleForChoice', () => {
  it('has no rule for none', () => {
    expect(ruleForChoice('none', '2026-10-08')).toBeNull();
  });

  it('repeats every day for daily', () => {
    expect(ruleForChoice('daily', '2026-10-08')).toEqual({ kind: 'interval', every: 1 });
  });

  it('starts an interval at 2 days', () => {
    expect(ruleForChoice('interval', '2026-10-08')).toEqual({ kind: 'interval', every: 2 });
  });

  it('repeats weekly on the weekday of the date', () => {
    expect(ruleForChoice('weekly', '2026-10-08')).toEqual({ kind: 'weekly', days: [4] });
  });

  it('repeats monthly on the day of the date', () => {
    expect(ruleForChoice('monthly', '2026-10-31')).toEqual({ kind: 'monthly', day: 31 });
  });
});

describe('syncMonthly', () => {
  it('moves a monthly day with the date', () => {
    expect(syncMonthly({ kind: 'monthly', day: 9 }, '2026-10-20')).toEqual({
      kind: 'monthly',
      day: 20,
    });
  });

  it('returns any other rule unchanged', () => {
    const weekly: RecurrenceRule = { kind: 'weekly', days: [1] };
    expect(syncMonthly(weekly, '2026-10-20')).toBe(weekly);
  });

  it('keeps a monthly rule while there is no date', () => {
    const rule: RecurrenceRule = { kind: 'monthly', day: 9 };
    expect(syncMonthly(rule, null)).toBe(rule);
  });

  it('keeps no rule as no rule', () => {
    expect(syncMonthly(null, '2026-10-20')).toBeNull();
  });
});
