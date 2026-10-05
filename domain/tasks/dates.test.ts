import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, localDateIso } from './dates';

describe('addDays', () => {
  it.each<[string, number, string]>([
    ['2026-01-31', 1, '2026-02-01'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2026-10-25', 1, '2026-10-26'],
    ['2026-03-29', 1, '2026-03-30'],
    ['2026-10-04', 0, '2026-10-04'],
  ])('addDays(%s, %i) = %s', (iso, n, expected) => {
    expect(addDays(iso, n)).toBe(expected);
  });
});

describe('daysBetween', () => {
  it('counts calendar days across a clock change', () => {
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });
  it('is negative when b is before a', () => {
    expect(daysBetween('2026-10-05', '2026-10-04')).toBe(-1);
  });
  it('is zero for the same day', () => {
    expect(daysBetween('2026-10-05', '2026-10-05')).toBe(0);
  });
});

describe('localDateIso', () => {
  it('uses the local fields of the date', () => {
    expect(localDateIso(new Date(2026, 9, 4, 23, 59))).toBe('2026-10-04');
    expect(localDateIso(new Date(2026, 9, 5, 0, 0))).toBe('2026-10-05');
  });
  it('pads month and day', () => {
    expect(localDateIso(new Date(2026, 0, 2, 12, 0))).toBe('2026-01-02');
  });
});
