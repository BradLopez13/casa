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

export const DEFAULT_ORDER: readonly Category[] = CATEGORIES;

// Longest phrase first so a specific entry beats a shorter one it contains.
const ENTRIES: readonly (readonly [string, Category])[] = (
  Object.entries(CATEGORY_WORDS) as [Category, readonly string[]][]
)
  .flatMap(([category, words]) => words.map((word) => [word, category] as const))
  .sort((a, b) => b[0].length - a[0].length);

function containsWholeWords(text: string, phrase: string): boolean {
  let from = text.indexOf(phrase);
  while (from !== -1) {
    const before = from === 0 || text[from - 1] === ' ';
    const end = from + phrase.length;
    const after = end === text.length || text[end] === ' ';
    if (before && after) return true;
    from = text.indexOf(phrase, from + 1);
  }
  return false;
}

export function categorize(
  normalizedName: string,
  overrides?: ReadonlyMap<string, Category>,
): Category {
  const override = overrides?.get(normalizedName);
  if (override) return override;
  for (const [word, category] of ENTRIES) {
    if (containsWholeWords(normalizedName, word)) return category;
  }
  return 'other';
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
  return order.flatMap((category) => {
    const bucketItems = buckets.get(category);
    return bucketItems ? [{ category, items: bucketItems }] : [];
  });
}
