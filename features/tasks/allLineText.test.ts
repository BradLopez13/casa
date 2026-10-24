import { describe, expect, it } from 'vitest';
import { allLineText } from './allLineText';

const PURPOSE = 'Todo lo del hogar, por día.';

describe('allLineText', () => {
  // Fase 10c: the line first says what the tab is for, so Tareas does not read as Hoy again.
  it('mine, singular and plural', () => {
    expect(allLineText({ kind: 'mine', count: 1 })).toBe(`${PURPOSE} Te toca 1 en total.`);
    expect(allLineText({ kind: 'mine', count: 5 })).toBe(`${PURPOSE} Te tocan 5 en total.`);
  });

  it('household, singular and plural', () => {
    expect(allLineText({ kind: 'household', household: 1 })).toBe(
      `${PURPOSE} Al hogar le queda 1.`,
    );
    expect(allLineText({ kind: 'household', household: 8 })).toBe(
      `${PURPOSE} Al hogar le quedan 8.`,
    );
  });

  it('nothing for anyone, or nothing mine', () => {
    expect(allLineText({ kind: 'empty' })).toBe(`${PURPOSE} Nada pendiente.`);
    expect(allLineText({ kind: 'nothingMine' })).toBe(`${PURPOSE} Nada tuyo pendiente.`);
  });

  it('a member, with their name', () => {
    expect(allLineText({ kind: 'person', name: 'Ana', count: 0 })).toBe(
      `${PURPOSE} A Ana no le toca nada.`,
    );
    expect(allLineText({ kind: 'person', name: 'Ana', count: 1 })).toBe(
      `${PURPOSE} A Ana le toca 1.`,
    );
    expect(allLineText({ kind: 'person', name: 'Ana', count: 2 })).toBe(
      `${PURPOSE} A Ana le tocan 2.`,
    );
  });
});
