import { CATEGORY_WORDS } from './categoryWords.es';

export const CATEGORIES = [
  'produce',
  'meat_fish',
  'dairy_eggs',
  'bakery',
  'pantry',
  'frozen',
  'drinks',
  'cleaning',
  'hygiene',
  'other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const DEFAULT_ORDER: typeof CATEGORIES = CATEGORIES;

// Insertion order is category order; Array.prototype.sort is stable (ES2019), and
// categorize relies on that for deterministic ties.
const ENTRIES: readonly (readonly [string, Category])[] = (
  Object.entries(CATEGORY_WORDS) as [Category, readonly string[]][]
).flatMap(([category, words]) => words.map((word) => [word, category] as const));

/** Index of the first whole-word occurrence of phrase in text, or -1. */
function wholeWordIndex(text: string, phrase: string): number {
  let from = text.indexOf(phrase);
  while (from !== -1) {
    const before = from === 0 || text[from - 1] === ' ';
    const end = from + phrase.length;
    const after = end === text.length || text[end] === ' ';
    if (before && after) return from;
    from = text.indexOf(phrase, from + 1);
  }
  return -1;
}

// The head noun comes first in Spanish: earliest match wins, then the longest phrase.
export function categorize(
  normalizedName: string,
  overrides?: ReadonlyMap<string, Category>,
): Category {
  const override = overrides?.get(normalizedName);
  if (override) return override;
  let best: Category = 'other';
  let bestIndex = Infinity;
  let bestLength = 0;
  for (const [word, category] of ENTRIES) {
    const index = wholeWordIndex(normalizedName, word);
    if (index === -1) continue;
    if (index < bestIndex || (index === bestIndex && word.length > bestLength)) {
      best = category;
      bestIndex = index;
      bestLength = word.length;
    }
  }
  return best;
}

export function groupByCategory<T extends { normalizedName: string; category?: Category | null }>(
  items: readonly T[],
  order: readonly Category[],
  overrides?: ReadonlyMap<string, Category>,
): { category: Category; items: T[] }[] {
  const buckets = new Map<Category, T[]>();
  for (const item of items) {
    const category = item.category ?? categorize(item.normalizedName, overrides);
    const bucket = buckets.get(category);
    if (bucket) bucket.push(item);
    else buckets.set(category, [item]);
  }
  // Categories missing from order go last so no item vanishes.
  const full = [...order, ...CATEGORIES.filter((c) => !order.includes(c))];
  return full.flatMap((category) => {
    const bucketItems = buckets.get(category);
    return bucketItems ? [{ category, items: bucketItems }] : [];
  });
}
