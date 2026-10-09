import { describe, expect, it } from 'vitest';
import { dayHeading, dueLabel, longDateLabel, overdueLabel } from './labels';

describe('dueLabel', () => {
  const today = '2026-10-04';
  it('labels today, tomorrow, yesterday and no date', () => {
    expect(dueLabel('2026-10-04', today)).toBe('Hoy');
    expect(dueLabel('2026-10-05', today)).toBe('Mañana');
    expect(dueLabel('2026-10-03', today)).toBe('Ayer');
    expect(dueLabel(null, today)).toBe('Sin fecha');
  });
  it('writes a far date with the Spanish month name', () => {
    expect(dueLabel('2026-10-20', today)).toContain('octubre');
    expect(dueLabel('2026-12-24', today)).toContain('diciembre');
  });
});

describe('overdueLabel', () => {
  const today = '2026-10-09';
  it('says yesterday', () => expect(overdueLabel('2026-10-08', today)).toBe('Vencida ayer'));
  it('uses weekday and day within the last week', () =>
    expect(overdueLabel('2026-10-05', today)).toBe('Vencida el lunes 5'));
  it('uses day and month from seven days on', () =>
    expect(overdueLabel('2026-10-02', today)).toBe('Vencida el 2 de octubre'));
});

describe('longDateLabel', () => {
  it('writes weekday, day and month', () =>
    expect(longDateLabel('2026-10-09')).toBe('viernes, 9 de octubre'));
});

describe('dayHeading', () => {
  const today = '2026-10-09';
  it('labels today and tomorrow', () => {
    expect(dayHeading('2026-10-09', today)).toBe('Hoy');
    expect(dayHeading('2026-10-10', today)).toBe('Mañana');
  });
  it('uses weekday and day otherwise', () =>
    expect(dayHeading('2026-10-11', today)).toBe('domingo 11'));
});
