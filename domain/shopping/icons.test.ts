import { describe, expect, it } from 'vitest';
import glyphs from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';
import { FALLBACK_ICON, iconFor } from './icons';
import { PRODUCT_ICONS_EN } from './productIcons.en';
import { PRODUCT_ICONS_ES } from './productIcons.es';

describe('iconFor', () => {
  it('matches a whole word', () => expect(iconFor('leche', 'es')).toBe('cow'));
  it('does not match inside a word', () => expect(iconFor('panameño', 'es')).toBe(FALLBACK_ICON));
  it('takes the head noun in Spanish', () =>
    expect(iconFor('zumo de naranja', 'es')).toBe('cup-water'));
  it('takes the head noun in English', () =>
    expect(iconFor('orange juice', 'en')).toBe('cup-water'));
  it('prefers the longer phrase at the same position', () =>
    expect(iconFor('papel higienico', 'es')).toBe('paper-roll'));
  it('prefers the longer phrase over a shorter word at the same position', () => {
    expect(iconFor('pasta de dientes', 'es')).toBe('toothbrush-paste');
    expect(iconFor('queso fresco', 'es')).toBe('cheese');
    expect(iconFor('black pepper', 'en')).toBe('shaker');
  });
  it('falls back to the basket', () => {
    expect(iconFor('cosa rara', 'es')).toBe(FALLBACK_ICON);
    expect(iconFor('', 'es')).toBe(FALLBACK_ICON);
  });
  // The 30 most frequent products, each with a glyph that reads at 22 dp.
  it.each([
    ['leche', 'cow'],
    ['pan', 'bread-slice'],
    ['huevos', 'egg'],
    ['agua', 'water'],
    ['aceite de oliva', 'bottle-tonic'],
    ['tomates', 'food-apple'],
    ['platanos', 'food-apple'],
    ['patatas', 'sprout'],
    ['cebollas', 'sprout'],
    ['manzanas', 'food-apple'],
    ['fruta', 'food-apple'],
    ['lechuga', 'leaf'],
    ['yogures', 'cup'],
    ['queso', 'cheese'],
    ['jamon', 'pig'],
    ['pollo', 'food-drumstick'],
    ['carne picada', 'food-steak'],
    ['atun en lata', 'fish'],
    ['cafe', 'coffee'],
    ['arroz', 'rice'],
    ['pasta', 'pasta'],
    ['azucar', 'sack'],
    ['galletas', 'cookie'],
    ['cerveza', 'beer'],
    ['vino', 'bottle-wine'],
    ['zumo de naranja', 'cup-water'],
    ['detergente', 'washing-machine'],
    ['lavavajillas', 'dishwasher'],
    ['papel higienico', 'paper-roll'],
    ['pasta de dientes', 'toothbrush-paste'],
  ])('es: %s → %s', (name, icon) => expect(iconFor(name, 'es')).toBe(icon));
  it.each([
    ['milk', 'cow'],
    ['bread', 'bread-slice'],
    ['eggs', 'egg'],
    ['water', 'water'],
    ['olive oil', 'bottle-tonic'],
    ['tomatoes', 'food-apple'],
    ['bananas', 'food-apple'],
    ['potatoes', 'sprout'],
    ['onions', 'sprout'],
    ['apples', 'food-apple'],
    ['fruit', 'food-apple'],
    ['lettuce', 'leaf'],
    ['yogurt', 'cup'],
    ['cheese', 'cheese'],
    ['ham', 'pig'],
    ['chicken', 'food-drumstick'],
    ['ground beef', 'food-steak'],
    ['canned tuna', 'fish'],
    ['coffee', 'coffee'],
    ['rice', 'rice'],
    ['pasta', 'pasta'],
    ['sugar', 'sack'],
    ['biscuits', 'cookie'],
    ['beer', 'beer'],
    ['wine', 'bottle-wine'],
    ['orange juice', 'cup-water'],
    ['detergent', 'washing-machine'],
    ['dish soap', 'dishwasher'],
    ['toilet paper', 'paper-roll'],
    ['toothpaste', 'toothbrush-paste'],
  ])('en: %s → %s', (name, icon) => expect(iconFor(name, 'en')).toBe(icon));
  it.each([
    ['es', PRODUCT_ICONS_ES],
    ['en', PRODUCT_ICONS_EN],
  ] as const)('%s: every icon exists in MaterialCommunityIcons', (_lang, entries) => {
    for (const [, icon] of entries) expect(glyphs).toHaveProperty(icon);
    expect(glyphs).toHaveProperty(FALLBACK_ICON);
  });
});
