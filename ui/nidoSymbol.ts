import { palettes, type Scheme } from './tokens';

/** Geometry of assets/brand/symbol.svg (viewBox 0 0 512 512). */
export const NIDO_SYMBOL_VIEWBOX = '0 0 512 512';

export const NIDO_SYMBOL_PATHS = {
  left: {
    circle: { cx: 130, cy: 95.5, r: 68 },
    path: 'M0 254.5A80 80 0 0 1 80 174.5H178A42 42 0 0 1 220 216.5V276.5H149A13 13 0 0 0 136 289.5V369.5A13 13 0 0 0 149 382.5H220V484.5H114A114 114 0 0 1 0 370.5Z',
  },
  right: {
    circle: { cx: 382, cy: 95.5, r: 68 },
    path: 'M512 254.5V370.5A114 114 0 0 1 398 484.5H220A30 30 0 0 1 190 454.5V412.5A30 30 0 0 1 220 382.5H363A13 13 0 0 0 376 369.5V289.5A13 13 0 0 0 363 276.5H292V216.5A42 42 0 0 1 334 174.5H432A80 80 0 0 1 512 254.5Z',
  },
} as const;

/**
 * The symbol always sits on slate: light mode paints a slate tile behind it, dark mode already
 * has a slate page so `tile` is null. The left figure is chalk, the right one pósit yellow.
 */
export function nidoSymbolColors(scheme: Scheme): {
  left: string;
  right: string;
  tile: string | null;
} {
  return {
    left: palettes[scheme].onBrandBand,
    right: '#F2D04B',
    tile: scheme === 'dark' ? null : '#2E3B41',
  };
}
