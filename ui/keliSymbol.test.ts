import { expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import { SYMBOL_PLATE, keliSymbolColors } from './keliSymbol';
import { palettes } from './tokens';

it('puts the light symbol on a slate tile', () => {
  expect(keliSymbolColors('light')).toEqual({ left: '#F3F4F0', right: '#F2D04B', tile: '#2E3B41' });
});
it('shows the dark symbol straight on the page', () => {
  expect(keliSymbolColors('dark').tile).toBeNull();
});
it.each(['light', 'dark'] as const)(
  'both figures stand out from what is behind them in %s',
  (s) => {
    const { left, right, tile } = keliSymbolColors(s);
    const ground = tile ?? palettes[s].page;
    expect(contrastRatio(left, ground)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(right, ground)).toBeGreaterThanOrEqual(3);
  },
);

it('the symbol plate is 56 dp with the symbol at 40', () => {
  expect(SYMBOL_PLATE.size).toBe(56);
  expect(SYMBOL_PLATE.size - 2 * SYMBOL_PLATE.inset).toBe(40);
});
