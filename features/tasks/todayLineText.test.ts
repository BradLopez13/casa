import { describe, expect, it } from 'vitest';
import type { TodayLine } from '@/domain/tasks/todayLine';
import en from '@/i18n/en.json';
import { todayLineText } from './todayLineText';

const text = (line: TodayLine) => todayLineText(line);

describe('todayLineText', () => {
  it('mine today, singular and plural, with the household underneath', () => {
    expect(text({ kind: 'mine', today: 1, overdue: 0, household: 1 })).toEqual({
      first: 'Te toca 1.',
      number: '1',
      second: 'Al hogar le queda 1.',
    });
    expect(text({ kind: 'mine', today: 2, overdue: 0, household: 3 })).toEqual({
      first: 'Te tocan 2.',
      number: '2',
      second: 'Al hogar le quedan 3.',
    });
  });

  it('always says the household line, even when nothing else is left', () => {
    expect(text({ kind: 'mine', today: 2, overdue: 0, household: 0 }).second).toBe(
      'Nada más para el hogar.',
    );
  });

  it('has no household line while the filter is already «Tú»', () => {
    expect(text({ kind: 'mine', today: 2, overdue: 0, household: null }).second).toBeNull();
  });

  it('separates what is overdue from today, in one sentence with the household (fase 10c)', () => {
    expect(text({ kind: 'mine', today: 2, overdue: 1, household: 3 })).toEqual({
      first: 'Te tocan 2.',
      number: '2',
      second: 'Y 1 de días anteriores; al hogar le quedan 3.',
    });
    expect(text({ kind: 'mine', today: 1, overdue: 2, household: null }).second).toBe(
      'Y 2 de días anteriores.',
    );
  });

  it('nothing for today but something overdue: the overdue count is the number', () => {
    expect(text({ kind: 'mine', today: 0, overdue: 3, household: 0 })).toEqual({
      first: 'Nada para hoy.',
      number: null,
      second: '3 de días anteriores; al hogar no le queda nada más.',
    });
    expect(text({ kind: 'mine', today: 0, overdue: 1, household: 2 }).second).toBe(
      '1 de días anteriores; al hogar le quedan 2.',
    );
    expect(text({ kind: 'mine', today: 0, overdue: 1, household: null }).second).toBe(
      '1 de días anteriores.',
    );
  });

  it('says a single household left in one sentence too', () => {
    expect(text({ kind: 'mine', today: 1, overdue: 1, household: 1 }).second).toBe(
      'Y 1 de días anteriores; al hogar le queda 1.',
    );
  });

  it('household only', () => {
    expect(text({ kind: 'household', household: 1 })).toEqual({
      first: 'Al hogar le queda 1.',
      number: '1',
      second: null,
    });
    expect(text({ kind: 'household', household: 3 }).first).toBe('Al hogar le quedan 3.');
  });

  it('nothing mine, with and without unassigned', () => {
    expect(text({ kind: 'nothingMine', unassigned: 1 })).toEqual({
      first: 'Nada tuyo hoy. Hay 1 sin asignar.',
      number: '1',
      second: null,
    });
    expect(text({ kind: 'nothingMine', unassigned: 2 }).first).toBe(
      'Nada tuyo hoy. Hay 2 sin asignar.',
    );
    expect(text({ kind: 'nothingMine', unassigned: 0 })).toEqual({
      first: 'Nada tuyo hoy.',
      number: null,
      second: null,
    });
  });

  it('another person', () => {
    expect(text({ kind: 'person', name: 'Segundo', count: 1 }).first).toBe('A Segundo le toca 1.');
    expect(text({ kind: 'person', name: 'Segundo', count: 2 }).first).toBe('A Segundo le tocan 2.');
    expect(text({ kind: 'person', name: 'Segundo', count: 0 })).toEqual({
      first: 'A Segundo no le toca nada hoy.',
      number: null,
      second: null,
    });
  });

  it('all done and empty', () => {
    expect(text({ kind: 'allDone' }).first).toBe('Todo hecho por hoy.');
    expect(text({ kind: 'empty' }).first).toBe('Nada para hoy');
  });

  it('reads as one sentence in English too: no double stop, no capital after the semicolon', () => {
    const fill = (text: string, vars: Record<string, string>) =>
      Object.entries(vars).reduce((out, [k, v]) => out.replace(`{${k}}`, v), text);
    const sentence = fill(en['today.line.joined'], {
      overdue: en['today.line.overduePartOne'],
      household: fill(en['today.line.householdPartOther'], { count: '3' }),
    });
    expect(sentence).toBe('And 1 from earlier days; 3 left for the household.');
  });
});
