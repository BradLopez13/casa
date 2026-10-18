import { describe, expect, it } from 'vitest';
import { weekLineText } from './weekLineText';

describe('weekLineText', () => {
  it('mine, singular and plural', () => {
    expect(weekLineText({ kind: 'mine', count: 1 })).toBe('Te toca 1 esta semana.');
    expect(weekLineText({ kind: 'mine', count: 2 })).toBe('Te tocan 2 esta semana.');
  });

  it('household, singular and plural', () => {
    expect(weekLineText({ kind: 'household', household: 1 })).toBe(
      'Al hogar le queda 1 esta semana.',
    );
    expect(weekLineText({ kind: 'household', household: 3 })).toBe(
      'Al hogar le quedan 3 esta semana.',
    );
  });

  it('nothing for anyone, or nothing mine', () => {
    expect(weekLineText({ kind: 'empty' })).toBe('Nada pendiente esta semana.');
    expect(weekLineText({ kind: 'nothingMine' })).toBe('Nada tuyo esta semana.');
  });

  it('a member, with their name', () => {
    expect(weekLineText({ kind: 'person', name: 'Ana', count: 1 })).toBe(
      'A Ana le toca 1 esta semana.',
    );
    expect(weekLineText({ kind: 'person', name: 'Ana', count: 4 })).toBe(
      'A Ana le tocan 4 esta semana.',
    );
    expect(weekLineText({ kind: 'person', name: 'Ana', count: 0 })).toBe(
      'A Ana no le toca nada esta semana.',
    );
  });
});
