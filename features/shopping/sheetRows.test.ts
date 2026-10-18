import { describe, expect, it } from 'vitest';
import { DEFAULT_ORDER, type Category } from '@/domain/shopping/categories';
import type { ShoppingItem } from '@/domain/shopping/list';
import {
  BOUGHT_HEADER_ID,
  categoryHeaderId,
  isBoughtHeader,
  isCategoryHeader,
  isItemRow,
  sheetRows,
} from './sheetRows';

const item = (id: string): ShoppingItem => ({ id }) as ShoppingItem;
const named = (id: string, normalizedName: string, category: Category | null = null) =>
  ({ id, normalizedName, category }) as ShoppingItem;

describe('sheetRows', () => {
  it('puts the header between pending and bought, keyed apart from every item', () => {
    const rows = sheetRows([item('a'), item('b')], [item('c')]);
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', BOUGHT_HEADER_ID, 'c']);
    expect(rows.filter(isBoughtHeader)).toHaveLength(1);
  });

  it('has no header when nothing is bought', () => {
    expect(sheetRows([item('a')], []).map((r) => r.id)).toEqual(['a']);
  });

  it('keeps a moved item at the same key', () => {
    const before = sheetRows([item('a')], []);
    const after = sheetRows([], [item('a')]);
    expect(before[0]?.id).toBe(after[1]?.id);
  });

  it('keeps the header but drops the bought rows when collapsed', () => {
    const rows = sheetRows([item('a')], [item('c')], true);
    expect(rows.map((r) => r.id)).toEqual(['a', BOUGHT_HEADER_ID]);
  });
});

describe('sheetRows grouped by category', () => {
  const pending = [
    named('a', 'detergente'),
    named('b', 'leche'),
    named('c', 'manzanas'),
    named('d', 'yogur'),
  ];

  it('heads each group of pending items, in the household order', () => {
    const rows = sheetRows(pending, [], false, { order: DEFAULT_ORDER });
    expect(rows.map((r) => r.id)).toEqual([
      categoryHeaderId('produce'),
      'c',
      categoryHeaderId('dairy_eggs'),
      'b',
      'd',
      categoryHeaderId('cleaning'),
      'a',
    ]);
    expect(rows.filter(isCategoryHeader).map((r) => r.category)).toEqual([
      'produce',
      'dairy_eggs',
      'cleaning',
    ]);
  });

  it('follows a reordered aisle', () => {
    const order: Category[] = ['cleaning', 'dairy_eggs', 'produce'];
    const rows = sheetRows(pending, [], false, { order });
    expect(rows.filter(isCategoryHeader).map((r) => r.category)).toEqual([
      'cleaning',
      'dairy_eggs',
      'produce',
    ]);
  });

  it('uses the household corrections, and an item category above both', () => {
    const overrides = new Map<string, Category>([['leche', 'drinks']]);
    const rows = sheetRows([...pending, named('e', 'pan', 'frozen')], [], false, {
      order: DEFAULT_ORDER,
      overrides,
    });
    const header = (c: Category) => rows.findIndex((r) => r.id === categoryHeaderId(c));
    expect(rows[header('drinks') + 1]?.id).toBe('b');
    expect(rows[header('frozen') + 1]?.id).toBe('e');
    expect(header('bakery')).toBe(-1);
  });

  it('leaves the bought rows flat, after the bought header', () => {
    const rows = sheetRows([named('b', 'leche')], [named('c', 'manzanas')], false, {
      order: DEFAULT_ORDER,
    });
    expect(rows.map((r) => r.id)).toEqual([
      categoryHeaderId('dairy_eggs'),
      'b',
      BOUGHT_HEADER_ID,
      'c',
    ]);
  });

  it('has no category header without pending items', () => {
    const rows = sheetRows([], [named('c', 'manzanas')], false, { order: DEFAULT_ORDER });
    expect(rows.filter(isCategoryHeader)).toHaveLength(0);
  });

  it('keeps item keys as their ids, and tells items from headers', () => {
    const before = sheetRows([named('b', 'leche')], [], false, { order: DEFAULT_ORDER });
    const after = sheetRows([], [named('b', 'leche')], false, { order: DEFAULT_ORDER });
    expect(before.filter(isItemRow).map((r) => r.id)).toEqual(['b']);
    expect(after.filter(isItemRow).map((r) => r.id)).toEqual(['b']);
  });
});
