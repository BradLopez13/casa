import { describe, expect, it } from 'vitest';
import glyphs from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';
import { FALLBACK_ICON, iconFor } from './icons';
import { PRODUCT_ICONS_EN } from './productIcons.en';
import { PRODUCT_ICONS_ES } from './productIcons.es';

describe('iconFor', () => {
  it('matches a whole word', () => expect(iconFor('leche', 'es')).toBe('cup'));
  it('does not match inside a word', () => expect(iconFor('panameño', 'es')).toBe(FALLBACK_ICON));
  it('takes the head noun in Spanish', () => expect(iconFor('zumo de naranja', 'es')).toBe('cup-water'));
  it('takes the head noun in English', () => expect(iconFor('orange juice', 'en')).toBe('cup-water'));
  it('prefers the longer phrase at the same position', () =>
    expect(iconFor('papel higienico', 'es')).toBe('paper-roll'));
  it('falls back to the basket', () => {
    expect(iconFor('cosa rara', 'es')).toBe(FALLBACK_ICON);
    expect(iconFor('', 'es')).toBe(FALLBACK_ICON);
  });
  it.each([
    ['es', PRODUCT_ICONS_ES],
    ['en', PRODUCT_ICONS_EN],
  ] as const)('%s: every icon exists in MaterialCommunityIcons', (_lang, entries) => {
    for (const [, icon] of entries) expect(glyphs).toHaveProperty(icon);
    expect(glyphs).toHaveProperty(FALLBACK_ICON);
  });
});
