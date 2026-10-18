import { describe, expect, it } from 'vitest';
import { normalizeItemName } from './normalize';
import { suggest, usual, type HistoryEntry } from './suggest';

const entry = (name: string): HistoryEntry => ({
  name,
  normalizedName: normalizeItemName(name),
  uses: 1,
  lastUsedAt: '2026-10-01T10:00:00.000Z',
  category: null,
});

const history = ['Leche', 'Lechuga', 'Pan de leche', 'Pan'].map(entry);
const names = (list: HistoryEntry[]) => list.map((e) => e.name);

describe('suggest', () => {
  it('puts prefix matches first, then word matches', () => {
    expect(names(suggest(history, 'le', new Set()))).toEqual(['Leche', 'Lechuga', 'Pan de leche']);
  });

  it('excludes pending items', () => {
    expect(names(suggest(history, 'le', new Set(['leche'])))).toEqual(['Lechuga', 'Pan de leche']);
  });

  it('returns nothing for an empty prefix', () => {
    expect(suggest(history, '', new Set())).toEqual([]);
    expect(suggest(history, '   ', new Set())).toEqual([]);
  });

  it('is accent and case insensitive', () => {
    expect(names(suggest(history, 'LÉ', new Set()))).toHaveLength(3);
  });

  it('returns at most 5', () => {
    const many = Array.from({ length: 8 }, (_, i) => entry(`Pan ${i}`));
    expect(suggest(many, 'pan', new Set())).toHaveLength(5);
  });
});

describe('usual', () => {
  const used = (name: string, uses: number): HistoryEntry => ({ ...entry(name), uses });

  it('returns the six most used that are not pending, by uses then name', () => {
    const list = [
      used('Pan', 5),
      used('Arroz', 5),
      used('Leche', 9),
      used('Sal', 1),
      used('Huevos', 4),
      used('Aceite', 3),
      used('Café', 2),
      used('Té', 1),
    ];
    expect(names(usual(list, new Set(['pan'])))).toEqual([
      'Leche',
      'Arroz',
      'Huevos',
      'Aceite',
      'Café',
      'Sal',
    ]);
  });

  it('is empty without history', () => {
    expect(usual([], new Set())).toEqual([]);
  });
});
