import { describe, expect, it } from 'vitest';
import { isQuickDay, quickDays } from './day-cells';

describe('day cells', () => {
  it('lists today and the next three days across a year boundary', () => {
    expect(quickDays('2026-12-30')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
  });

  it('recognises quick days only', () => {
    expect(isQuickDay('2027-01-02', '2026-12-30')).toBe(true);
    expect(isQuickDay('2027-01-03', '2026-12-30')).toBe(false);
    expect(isQuickDay(null, '2026-12-30')).toBe(false);
  });
});
