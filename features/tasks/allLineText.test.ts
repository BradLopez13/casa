import { describe, expect, it } from 'vitest';
import { allLineText } from './allLineText';

describe('allLineText', () => {
  it('mine, singular and plural', () => {
    expect(allLineText({ kind: 'mine', count: 1 })).toBe('Te toca 1 en total.');
    expect(allLineText({ kind: 'mine', count: 5 })).toBe('Te tocan 5 en total.');
  });

  it('household, singular and plural', () => {
    expect(allLineText({ kind: 'household', household: 1 })).toBe('Al hogar le queda 1.');
    expect(allLineText({ kind: 'household', household: 8 })).toBe('Al hogar le quedan 8.');
  });

  it('nothing for anyone, or nothing mine', () => {
    expect(allLineText({ kind: 'empty' })).toBe('Nada pendiente.');
    expect(allLineText({ kind: 'nothingMine' })).toBe('Nada tuyo pendiente.');
  });

  it('a member, with their name', () => {
    expect(allLineText({ kind: 'person', name: 'Ana', count: 0 })).toBe('A Ana no le toca nada.');
    expect(allLineText({ kind: 'person', name: 'Ana', count: 1 })).toBe('A Ana le toca 1.');
    expect(allLineText({ kind: 'person', name: 'Ana', count: 2 })).toBe('A Ana le tocan 2.');
  });
});
