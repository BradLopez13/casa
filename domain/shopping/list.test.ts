import { describe, expect, it } from 'vitest';
import { applyAdd, applyBought, findPending, sortList, type ShoppingItem } from './list';
import { normalizeItemName } from './normalize';

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

describe('sortList', () => {
  it('orders pending by createdAt descending and bought by boughtAt descending', () => {
    const items = [
      make('a', 'Pan', { createdAt: '2026-10-01T10:00:00.000Z' }),
      make('b', 'Leche', { createdAt: '2026-10-03T10:00:00.000Z' }),
      make('c', 'Sal', { boughtAt: '2026-10-04T10:00:00.000Z', boughtBy: 'u1' }),
      make('d', 'Té', { boughtAt: '2026-10-05T10:00:00.000Z', boughtBy: 'u2' }),
    ];
    const { pending, bought } = sortList(items);
    expect(pending.map((i) => i.id)).toEqual(['b', 'a']);
    expect(bought.map((i) => i.id)).toEqual(['d', 'c']);
  });
});

describe('findPending', () => {
  it('matches by normalized name and ignores bought items', () => {
    const items = [make('a', 'Leche'), make('b', 'Pan', { boughtAt: '2026-10-04T10:00:00.000Z' })];
    expect(findPending(items, 'LÉCHE')?.id).toBe('a');
    expect(findPending(items, 'pan')).toBeUndefined();
  });
});

describe('applyAdd', () => {
  it('leaves the list untouched when a pending duplicate exists', () => {
    const items = [make('a', 'Leche')];
    expect(applyAdd(items, make('b', 'leche'))).toBe(items);
  });

  it('adds a new item', () => {
    const items = [make('a', 'Leche')];
    const next = applyAdd(items, make('b', 'Pan'));
    expect(next.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('keeps only the already existing item when the resolved id differs', () => {
    const items = [make('a', 'Leche'), make('b', 'Leche')];
    const next = applyAdd(items, make('b', 'Leche'), 'a');
    expect(next.map((i) => i.id)).toEqual(['a']);
  });

  it('adds a bought duplicate as a new pending item', () => {
    const items = [make('a', 'Leche', { boughtAt: '2026-10-04T10:00:00.000Z' })];
    expect(applyAdd(items, make('b', 'Leche'))).toHaveLength(2);
  });
});

describe('applyBought', () => {
  const items = [make('a', 'Leche'), make('b', 'Pan')];

  it('marks as bought and keeps other references', () => {
    const next = applyBought(items, 'a', true, 'u9', '2026-10-06T10:00:00.000Z');
    expect(next[0]).toMatchObject({ boughtAt: '2026-10-06T10:00:00.000Z', boughtBy: 'u9' });
    expect(next[1]).toBe(items[1]);
  });

  it('unmarks', () => {
    const bought = applyBought(items, 'a', true, 'u9', '2026-10-06T10:00:00.000Z');
    const next = applyBought(bought, 'a', false, 'u9', '2026-10-07T10:00:00.000Z');
    expect(next[0]).toMatchObject({ boughtAt: null, boughtBy: null });
    expect(next[1]).toBe(items[1]);
  });
});
