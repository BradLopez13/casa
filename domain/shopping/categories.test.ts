import { describe, expect, it } from 'vitest';
import { categorize, DEFAULT_ORDER, groupByCategory, type Category } from './categories';

describe('categorize', () => {
  it('uses the dictionary', () => {
    expect(categorize('leche')).toBe('dairy_eggs');
    expect(categorize('manzanas')).toBe('produce');
    expect(categorize('papel higienico')).toBe('hygiene');
    expect(categorize('leche de avena')).toBe('dairy_eggs');
  });
  it('falls back to other', () => {
    expect(categorize('xyz')).toBe('other');
  });
  it('does not match inside words', () => {
    expect(categorize('panadero')).toBe('other');
  });
  it('override wins', () => {
    expect(categorize('leche', new Map<string, Category>([['leche', 'drinks']]))).toBe('drinks');
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
    expect(custom.map((g) => g.category)).toEqual(['bakery', 'dairy_eggs']);
  });
  it('uses an explicit category', () => {
    const groups = groupByCategory(
      [{ normalizedName: 'leche', category: 'drinks' }],
      DEFAULT_ORDER,
    );
    expect(groups.map((g) => g.category)).toEqual(['drinks']);
  });
});
