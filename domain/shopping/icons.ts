import { lang as appLang, type Locale } from '@/i18n';
import { PRODUCT_ICONS_EN } from './productIcons.en';
import { PRODUCT_ICONS_ES } from './productIcons.es';

/** A MaterialCommunityIcons glyph name. */
export type ProductIcon = string;

export const FALLBACK_ICON: ProductIcon = 'basket';

type Entries = readonly (readonly [string, ProductIcon])[];

const ENTRIES: Record<Locale, Entries> = { es: PRODUCT_ICONS_ES, en: PRODUCT_ICONS_EN };

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

/**
 * The icon of a product name, from the dictionary of the app's language. The head noun comes
 * first in Spanish («zumo de naranja») and last in English («orange juice»): the match nearest
 * that end wins, then the longest phrase.
 */
export function iconFor(normalizedName: string, lang: Locale = appLang): ProductIcon {
  const headLast = lang === 'en';
  let best: ProductIcon = FALLBACK_ICON;
  let bestRank = -Infinity;
  let bestLength = 0;
  for (const [word, icon] of ENTRIES[lang]) {
    const index = wholeWordIndex(normalizedName, word);
    if (index === -1) continue;
    // Higher is nearer the head: the end of the match in English, the start in Spanish.
    const rank = headLast ? index + word.length : -index;
    if (rank > bestRank || (rank === bestRank && word.length > bestLength)) {
      best = icon;
      bestRank = rank;
      bestLength = word.length;
    }
  }
  return best;
}
