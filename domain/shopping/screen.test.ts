import { describe, expect, it } from 'vitest';
import type { ShoppingItem } from './list';
import { normalizeItemName } from './normalize';
import { doorLine, pendingNames, planAdd } from './screen';

const make = (id: string, name: string, over: Partial<ShoppingItem> = {}): ShoppingItem => ({
  id,
  name,
  normalizedName: normalizeItemName(name),
  quantity: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  createdBy: 'u1',
  boughtAt: null,
  boughtBy: null,
  ...over,
});

const bought = { boughtAt: '2026-10-02T10:00:00.000Z', boughtBy: 'u1' };

describe('doorLine', () => {
  it('says nothing is missing at zero, with no number', () => {
    expect(doorLine(0)).toEqual({ text: 'No falta nada.', number: null });
  });

  it('counts what is missing, singular and plural, with the number to draw larger', () => {
    expect(doorLine(1)).toEqual({ text: 'Falta 1 cosa.', number: '1' });
    expect(doorLine(12)).toEqual({ text: 'Faltan 12 cosas.', number: '12' });
  });
});

describe('planAdd', () => {
  it('adds a name that is not pending', () => {
    expect(planAdd([make('a', 'Pan')], 'Leche')).toEqual({ kind: 'add', name: 'Leche' });
  });

  it('points at the pending item with the same normalized name', () => {
    const items = [make('a', 'Leche'), make('b', 'Pan')];
    expect(planAdd(items, '  LÉCHE ')).toEqual({ kind: 'listed', id: 'a' });
  });

  it('adds again a name that is only among the bought items', () => {
    expect(planAdd([make('a', 'Leche', bought)], 'leche')).toEqual({ kind: 'add', name: 'leche' });
  });
});

describe('pendingNames', () => {
  it('collects the normalized names of the pending items only', () => {
    const items = [make('a', 'Leche'), make('b', 'Pan', bought), make('c', 'Té Verde')];
    expect(pendingNames(items)).toEqual(new Set(['leche', 'te verde']));
  });
});
