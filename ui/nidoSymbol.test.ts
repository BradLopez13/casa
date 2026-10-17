import { expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import { nidoSymbolColors } from './nidoSymbol';
import { palettes } from './tokens';

it('puts the light symbol on a slate tile', () => {
  expect(nidoSymbolColors('light')).toEqual({ left: '#F3F4F0', right: '#F2D04B', tile: '#2E3B41' });
});
it('shows the dark symbol straight on the page', () => {
  expect(nidoSymbolColors('dark').tile).toBeNull();
});
it.each(['light', 'dark'] as const)(
  'both figures stand out from what is behind them in %s',
  (s) => {
    const { left, right, tile } = nidoSymbolColors(s);
    const ground = tile ?? palettes[s].page;
    expect(contrastRatio(left, ground)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(right, ground)).toBeGreaterThanOrEqual(3);
  },
);
