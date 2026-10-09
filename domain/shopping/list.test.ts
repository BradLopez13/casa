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

describe('sortList ties', () => {
  it('breaks equal timestamps by id, whatever the input order', () => {
    const at = '2026-10-01T10:00:00.000Z';
    const a = make('a', 'A', { createdAt: at });
    const b = make('b', 'B', { createdAt: at });
    const c = make('c', 'C', { boughtAt: at });
    const d = make('d', 'D', { boughtAt: at });
    expect(sortList([b, a, d, c]).pending.map((i) => i.id)).toEqual(['a', 'b']);
    expect(sortList([a, b, c, d]).pending.map((i) => i.id)).toEqual(['a', 'b']);
    expect(sortList([d, c]).bought.map((i) => i.id)).toEqual(['c', 'd']);
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

  it('rebinds the optimistic item when the existing one is not cached', () => {
    const items = [make('b', 'Leche')];
    const next = applyAdd(items, make('b', 'Leche'), 'a');
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: 'a', name: 'Leche' });
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
