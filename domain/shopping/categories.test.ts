import { describe, expect, it } from 'vitest';
import { categorize, DEFAULT_ORDER, groupByCategory, type Category } from './categories';

describe('categorize', () => {
  it('uses the dictionary', () => {
    expect(categorize('leche')).toBe('dairy_eggs');
    expect(categorize('manzanas')).toBe('produce');
    expect(categorize('papel higienico')).toBe('hygiene');
    expect(categorize('leche de avena')).toBe('dairy_eggs');
    expect(categorize('yogur de fresa')).toBe('dairy_eggs');
    expect(categorize('zumo de naranja')).toBe('drinks');
    expect(categorize('salsa de tomate')).toBe('pantry');
    expect(categorize('pasta de dientes')).toBe('hygiene');
    expect(categorize('tomate frito')).toBe('pantry');
    expect(categorize('pan integral')).toBe('bakery');
  });
  it('falls back to other', () => {
    expect(categorize('xyz')).toBe('other');
  });
  it('does not match inside words', () => {
    expect(categorize('panadero')).toBe('other');
    expect(categorize('panal')).toBe('other');
    expect(categorize('pantalla')).toBe('other');
  });
  it('override wins', () => {
    expect(categorize('leche', new Map<string, Category>([['leche', 'drinks']]))).toBe('drinks');
  });
});

describe('categorize in English', () => {
  it('uses the English dictionary', () => {
    expect(categorize('milk', undefined, 'en')).toBe('dairy_eggs');
    expect(categorize('apples', undefined, 'en')).toBe('produce');
    expect(categorize('toilet paper', undefined, 'en')).toBe('hygiene');
    expect(categorize('dish soap', undefined, 'en')).toBe('cleaning');
    expect(categorize('whole wheat bread', undefined, 'en')).toBe('bakery');
  });
  it('reads the head noun at the end', () => {
    expect(categorize('orange juice', undefined, 'en')).toBe('drinks');
    expect(categorize('tomato sauce', undefined, 'en')).toBe('pantry');
    expect(categorize('oat milk', undefined, 'en')).toBe('dairy_eggs');
    expect(categorize('strawberry yogurt', undefined, 'en')).toBe('dairy_eggs');
    expect(categorize('ice cream', undefined, 'en')).toBe('frozen');
  });
  it('does not match inside words and falls back to other', () => {
    expect(categorize('breadboard', undefined, 'en')).toBe('other');
    expect(categorize('leche', undefined, 'en')).toBe('other');
  });
  it('takes Spanish words only with the Spanish dictionary', () => {
    expect(categorize('milk', undefined, 'es')).toBe('other');
  });
});

describe('groupByCategory', () => {
  const items = [
    { id: 1, normalizedName: 'pan' },
    { id: 2, normalizedName: 'leche' },
    { id: 3, normalizedName: 'huevos' },
    { id: 4, normalizedName: 'manzanas' },
  ];
  it('respects order, omits empty groups and keeps item order', () => {
    const groups = groupByCategory(items, DEFAULT_ORDER);
    expect(groups.map((g) => g.category)).toEqual(['produce', 'dairy_eggs', 'bakery']);
    expect(groups[1]?.items.map((i) => i.id)).toEqual([2, 3]);
    const custom = groupByCategory(items, ['bakery', 'dairy_eggs']);
    expect(custom.map((g) => g.category)).toEqual(['bakery', 'dairy_eggs', 'produce']);
  });
  it('uses an explicit category', () => {
    const groups = groupByCategory(
      [{ normalizedName: 'leche', category: 'drinks' }],
      DEFAULT_ORDER,
    );
    expect(groups.map((g) => g.category)).toEqual(['drinks']);
  });
  it('treats null category as unset and applies overrides', () => {
    const overrides = new Map<string, Category>([['leche', 'drinks']]);
    const groups = groupByCategory(
      [{ normalizedName: 'leche', category: null }],
      DEFAULT_ORDER,
      overrides,
    );
    expect(groups.map((g) => g.category)).toEqual(['drinks']);
  });
});
