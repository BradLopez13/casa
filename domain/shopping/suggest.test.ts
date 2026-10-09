import { describe, expect, it } from 'vitest';
import { normalizeItemName } from './normalize';
import { suggest, type HistoryEntry } from './suggest';

const entry = (name: string): HistoryEntry => ({
  name,
  normalizedName: normalizeItemName(name),
  uses: 1,
  lastUsedAt: '2026-10-01T10:00:00.000Z',
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
