import type { ShoppingItem } from '@/domain/shopping/list';

export const BOUGHT_HEADER_ID = 'bought-header';
export type BoughtHeaderRow = { id: typeof BOUGHT_HEADER_ID; kind: 'boughtHeader' };
export type SheetRow = ShoppingItem | BoughtHeaderRow;

const HEADER: BoughtHeaderRow = { id: BOUGHT_HEADER_ID, kind: 'boughtHeader' };

export function isBoughtHeader(row: SheetRow): row is BoughtHeaderRow {
  return 'kind' in row;
}

/**
 * The sheet as one flat keyed list: what is left to buy, the «Compradas» header (only when
 * something is bought), then the bought ones. One list, one key per row (the item id), so a row
 * that is marked keeps its identity and slides down instead of remounting.
 */
export function sheetRows(pending: ShoppingItem[], bought: ShoppingItem[]): SheetRow[] {
  return bought.length > 0 ? [...pending, HEADER, ...bought] : [...pending];
}
