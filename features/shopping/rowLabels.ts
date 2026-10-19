import { t } from '@/i18n';

/**
 * What a screen reader says for a bought row, read as one stop: the item, its quantity and who
 * bought it («Leche, 2, comprado por ti»). `buyer` is the buyer's name, undefined when they are
 * no longer in the household; `byMe` when the current user bought it.
 */
export function boughtRowLabel({
  name,
  quantity,
  buyer,
  byMe,
}: {
  name: string;
  quantity: string | null;
  buyer: string | undefined;
  byMe: boolean;
}): string {
  const item = quantity ? `${name}, ${quantity}` : name;
  if (byMe) return t('shopping.a11y.boughtRowYou', { item });
  if (buyer === undefined) return t('shopping.a11y.boughtRow', { item });
  return t('shopping.a11y.boughtRowBy', { item, name: buyer });
}

/** «En la bolsa (3)» as a screen reader should say it: «En la bolsa, 3 productos». */
export function boughtTitleLabel(count: number): string {
  return t(count === 1 ? 'shopping.a11y.boughtTitleOne' : 'shopping.a11y.boughtTitleOther', {
    n: count,
  });
}
