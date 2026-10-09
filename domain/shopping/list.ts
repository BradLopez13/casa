import { normalizeItemName } from './normalize';

export type ShoppingItem = {
  id: string;
  name: string;
  normalizedName: string;
  quantity: string | null;
  createdAt: string;
  createdBy: string | null;
  boughtAt: string | null;
  boughtBy: string | null;
};

// Newest first; ties fall back to the id so the order is stable across refetches.
const byDescending = (a: string, b: string, idA: string, idB: string) =>
  a < b ? 1 : a > b ? -1 : idA < idB ? -1 : idA > idB ? 1 : 0;

/** Pending items newest first; bought items most recently bought first. */
export function sortList(items: readonly ShoppingItem[]): {
  pending: ShoppingItem[];
  bought: ShoppingItem[];
} {
  const pending = items
    .filter((i) => i.boughtAt === null)
    .sort((a, b) => byDescending(a.createdAt, b.createdAt, a.id, b.id));
  const bought = items
    .filter((i) => i.boughtAt !== null)
    .sort((a, b) => byDescending(a.boughtAt ?? '', b.boughtAt ?? '', a.id, b.id));
  return { pending, bought };
}

export function findPending(
  items: readonly ShoppingItem[],
  name: string,
): ShoppingItem | undefined {
  const normalized = normalizeItemName(name);
  return items.find((i) => i.boughtAt === null && i.normalizedName === normalized);
}

/**
 * Applies an optimistic add. A pending duplicate leaves the list untouched. When the server
 * resolved the add to an item that already existed (`resolvedId` differs), the optimistic
 * item is dropped and the existing one stays.
 */
export function applyAdd(
  items: ShoppingItem[],
  item: ShoppingItem,
  resolvedId?: string,
): ShoppingItem[] {
  if (resolvedId !== undefined && resolvedId !== item.id) {
    if (items.some((i) => i.id === resolvedId)) return items.filter((i) => i.id !== item.id);
    // The existing item isn't cached (merged with another member's add): keep ours, rebound.
    return items.map((i) => (i.id === item.id ? { ...i, id: resolvedId } : i));
  }
  if (findPending(items, item.name)) return items;
  return [...items, item];
}

export function applyBought(
  items: ShoppingItem[],
  id: string,
  bought: boolean,
  userId: string,
  nowIso: string,
): ShoppingItem[] {
  return items.map((i) =>
    i.id !== id ? i : { ...i, boughtAt: bought ? nowIso : null, boughtBy: bought ? userId : null },
  );
}
