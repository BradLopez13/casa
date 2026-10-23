import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  dayCellLabel,
  dayHeading,
  dayInSentence,
  dayName,
  doneWhen,
  dueChipLabel,
  dueLabel,
  longDateLabel,
  overdueLabel,
  skippedNotice,
} from './labels';

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

describe('dueChipLabel', () => {
  const today = '2026-10-22';
  it('says a date that already went by is past, as the note in the list does (fase 10a)', () =>
    expect(dueChipLabel('2026-10-18', today)).toBe('domingo, 18 de octubre · pasada'));
  it('leaves yesterday, today and later as they are', () => {
    expect(dueChipLabel('2026-10-21', today)).toBe('Ayer');
    expect(dueChipLabel('2026-10-22', today)).toBe('Hoy');
    expect(dueChipLabel('2026-10-30', today)).toBe('viernes, 30 de octubre');
    expect(dueChipLabel(null, today)).toBe('Sin fecha');
  });
});

describe('overdueLabel', () => {
  const today = '2026-10-09';
  it('says yesterday', () =>
    expect(overdueLabel('2026-10-08', today)).toBe('Pendiente desde ayer'));
  it('uses weekday and day within the last week', () =>
    expect(overdueLabel('2026-10-05', today)).toBe('Pendiente desde el lunes 5'));
  it('uses day and month from seven days on', () =>
    expect(overdueLabel('2026-10-02', today)).toBe('Pendiente desde el 2 de octubre'));
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

describe('dayName', () => {
  const today = '2026-10-09';
  it('labels today and tomorrow', () => {
    expect(dayName('2026-10-09', today)).toBe('Hoy');
    expect(dayName('2026-10-10', today)).toBe('Mañana');
  });
  it('uses the weekday alone otherwise, capitalised like Hoy and Mañana', () =>
    expect(dayName('2026-10-11', today)).toBe('Domingo'));
});

describe('skippedNotice', () => {
  const today = '2026-10-09';
  it('says when the task comes back', () => {
    expect(skippedNotice('2026-10-10', today)).toBe('Saltada. Vuelve mañana.');
    expect(skippedNotice('2026-10-11', today)).toBe('Saltada. Vuelve el domingo 11.');
  });
  it('writes the day in lower case inside a sentence', () => {
    expect(dayInSentence('2026-10-10', today)).toBe('mañana');
    expect(dayInSentence('2026-10-11', today)).toBe('domingo 11');
  });
});

describe('labels on an English phone', () => {
  const today = '2026-10-09';
  let en: typeof import('./labels');

  beforeAll(async () => {
    vi.resetModules();
    vi.doMock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));
    en = await import('./labels');
  });
  afterAll(() => {
    vi.doUnmock('expo-localization');
    vi.resetModules();
  });

  it('labels relative days in English', () => {
    expect(en.dueLabel('2026-10-09', today)).toBe('Today');
    expect(en.dueLabel('2026-10-10', today)).toBe('Tomorrow');
    expect(en.dueLabel(null, today)).toBe('No date');
  });
  it('writes month and weekday names from Intl in English', () => {
    expect(en.longDateLabel('2026-10-09')).toBe('Friday, October 9');
    expect(en.dueLabel('2026-12-24', today)).toContain('December');
  });
  it('puts the weekday before the day number', () => {
    expect(en.dayHeading('2026-10-11', today)).toBe('Sunday 11');
    expect(en.weekdayDay('2026-10-11', 'short')).toBe('Sun 11');
    expect(en.dayName('2026-10-11', today)).toBe('Sunday');
  });
  it('says why a task is late', () => {
    expect(en.overdueLabel('2026-10-08', today)).toBe('Pending since yesterday');
    expect(en.overdueLabel('2026-10-05', today)).toBe('Pending since Monday 5');
    expect(en.overdueLabel('2026-10-02', today)).toBe('Pending since October 2');
  });
  it('keeps weekday capitals inside a sentence', () => {
    expect(en.dayInSentence('2026-10-10', today)).toBe('tomorrow');
    expect(en.skippedNotice('2026-10-10', today)).toBe('Skipped. Back tomorrow.');
    expect(en.skippedNotice('2026-10-11', today)).toBe('Skipped. Back on Sunday 11.');
  });
});

// A screen reader read the form's day cells as «20 mar» («veinte mar»): they say the whole date.
describe('dayCellLabel', () => {
  const today = '2026-10-19';
  it('says today with its full date', () => {
    expect(dayCellLabel('2026-10-19', today)).toBe('Hoy, lunes, 19 de octubre');
  });
  it('says any other day in full, never the short weekday', () => {
    expect(dayCellLabel('2026-10-20', today)).toBe('martes, 20 de octubre');
  });
});

describe('doneWhen', () => {
  const at = (y: number, m: number, d: number, hh: number, mm: number) =>
    new Date(y, m - 1, d, hh, mm).toISOString();

  it('today: the time alone', () => {
    expect(doneWhen(at(2026, 10, 9, 10, 42), '2026-10-09')).toBe('10:42');
  });

  it('yesterday: the word and the time', () => {
    expect(doneWhen(at(2026, 10, 8, 18, 5), '2026-10-09')).toBe('ayer, 18:05');
  });

  it('another day: day, short month and time', () => {
    expect(doneWhen(at(2026, 10, 2, 9, 0), '2026-10-09')).toBe('2 oct, 9:00');
  });

  it('just after local midnight is today, not yesterday', () => {
    expect(doneWhen(at(2026, 10, 9, 0, 3), '2026-10-09')).toBe('0:03');
  });
});
