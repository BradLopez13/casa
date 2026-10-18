import { describe, expect, it } from 'vitest';
import type { ShoppingItem } from '@/domain/shopping/list';
import { BOUGHT_HEADER_ID, isBoughtHeader, isItemRow, sheetRows } from './sheetRows';

const item = (id: string): ShoppingItem => ({ id }) as ShoppingItem;

describe('sheetRows', () => {
  it('returns the pending items as they are when nothing is bought', () => {
    const pending = [item('a'), item('b')];
    expect(sheetRows(pending, [])).toEqual(pending);
  });

  it('puts the header between pending and bought, keyed apart from every item', () => {
    const rows = sheetRows([item('a'), item('b')], [item('c')]);
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', BOUGHT_HEADER_ID, 'c']);
    expect(rows.filter(isBoughtHeader)).toHaveLength(1);
  });

  it('keeps the header but drops the bought rows when collapsed', () => {
    const rows = sheetRows([item('a')], [item('c')], true);
    expect(rows.map((r) => r.id)).toEqual(['a', BOUGHT_HEADER_ID]);
  });

  it('keeps a moved item at the same key', () => {
    const before = sheetRows([item('a')], []);
    const after = sheetRows([], [item('a')]);
    expect(before[0]?.id).toBe(after[1]?.id);
  });

  it('tells items from the header', () => {
    const rows = sheetRows([item('a')], [item('c')]);
    expect(rows.filter(isItemRow).map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('takes no grouping', () => {
    expect(sheetRows.length).toBe(2);
  });
});
