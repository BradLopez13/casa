import { describe, expect, it } from 'vitest';
import type { ShoppingItem } from '@/domain/shopping/list';
import { BOUGHT_HEADER_ID, isBoughtHeader, sheetRows } from './sheetRows';

const item = (id: string): ShoppingItem => ({ id }) as ShoppingItem;

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
