import { groupByCategory, type Category } from '@/domain/shopping/categories';
import type { ShoppingItem } from '@/domain/shopping/list';

export const BOUGHT_HEADER_ID = 'bought-header';
export type BoughtHeaderRow = { id: typeof BOUGHT_HEADER_ID; kind: 'boughtHeader' };
export type CategoryHeaderRow = {
  id: `category-${Category}`;
  kind: 'categoryHeader';
  category: Category;
};
export type SheetRow = ShoppingItem | BoughtHeaderRow | CategoryHeaderRow;

/** How the pending items are grouped: the household aisle order and its corrections. */
export type SheetGrouping = {
  order: readonly Category[];
  overrides?: ReadonlyMap<string, Category>;
};

const HEADER: BoughtHeaderRow = { id: BOUGHT_HEADER_ID, kind: 'boughtHeader' };

export const categoryHeaderId = (category: Category): CategoryHeaderRow['id'] =>
  `category-${category}`;

export function isBoughtHeader(row: SheetRow): row is BoughtHeaderRow {
  return 'kind' in row && row.kind === 'boughtHeader';
}

export function isCategoryHeader(row: SheetRow): row is CategoryHeaderRow {
  return 'kind' in row && row.kind === 'categoryHeader';
}

export function isItemRow(row: SheetRow): row is ShoppingItem {
  return !('kind' in row);
}

function groupedPending(pending: ShoppingItem[], grouping: SheetGrouping): SheetRow[] {
  return groupByCategory(pending, grouping.order, grouping.overrides).flatMap(
    ({ category, items }): SheetRow[] => [
      { id: categoryHeaderId(category), kind: 'categoryHeader', category },
      ...items,
    ],
  );
}

/**
 * The sheet as one flat keyed list: what is left to buy (under a header per category when
 * grouped), the «En la bolsa» header (only when something is bought), then the bought ones unless
 * the group is collapsed. One list, one key per row (the item id; `category-…` and
 * `bought-header` for the headers), so a row that is marked keeps its identity and slides down
 * instead of remounting.
 */
export function sheetRows(
  pending: ShoppingItem[],
  bought: ShoppingItem[],
  boughtCollapsed = false,
  grouping?: SheetGrouping,
): SheetRow[] {
  const top = grouping ? groupedPending(pending, grouping) : [...pending];
  if (bought.length === 0) return top;
  return boughtCollapsed ? [...top, HEADER] : [...top, HEADER, ...bought];
}
