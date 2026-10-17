import { describe, expect, it } from 'vitest';
import type { TodayLine } from '@/domain/tasks/todayLine';
import { todayLineText } from './todayLineText';

const text = (line: TodayLine) => todayLineText(line);

describe('todayLineText', () => {
  it('mine, singular and plural, with the household underneath', () => {
    expect(text({ kind: 'mine', count: 1, household: 1 })).toEqual({
      first: 'Te toca 1.',
      number: '1',
      second: 'Al hogar le queda 1.',
    });
    expect(text({ kind: 'mine', count: 2, household: 3 })).toEqual({
      first: 'Te tocan 2.',
      number: '2',
      second: 'Al hogar le quedan 3.',
    });
  });

  it('mine with nothing else left has no second line', () => {
    expect(text({ kind: 'mine', count: 2, household: 0 }).second).toBeNull();
    expect(text({ kind: 'mine', count: 2, household: null }).second).toBeNull();
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
});
