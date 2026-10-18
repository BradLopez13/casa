import { t } from '@/i18n';
import { findPending, type ShoppingItem } from './list';

/** The door's headline: how many things are missing, and the count to draw larger (§14.4). */
export function doorLine(pendingCount: number): { text: string; number: string | null } {
  if (pendingCount === 0) return { text: t('shopping.lineNone'), number: null };
  return {
    text: t(pendingCount === 1 ? 'shopping.lineOne' : 'shopping.lineOther', {
      count: pendingCount,
    }),
    number: String(pendingCount),
  };
}

export type AddPlan = { kind: 'add'; name: string } | { kind: 'listed'; id: string };

/** A name already pending points at that item instead of being added again. */
export function planAdd(items: readonly ShoppingItem[], name: string): AddPlan {
  const listed = findPending(items, name);
  return listed ? { kind: 'listed', id: listed.id } : { kind: 'add', name };
}

/** The normalized names on the list still to buy, which suggestions leave out. */
export function pendingNames(items: readonly ShoppingItem[]): Set<string> {
  return new Set(items.filter((i) => i.boughtAt === null).map((i) => i.normalizedName));
}
