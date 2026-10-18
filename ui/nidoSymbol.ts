import { palettes, type Scheme } from './tokens';

/**
 * Geometry of assets/brand/symbol.svg (viewBox 0 0 512 512). `monoPath` is the body from
 * symbol-mono.svg: in one ink the bases stop either side of a 24-unit seam so the people stay apart.
 */
export const NIDO_SYMBOL_VIEWBOX = '0 0 512 512';

export const NIDO_SYMBOL_PATHS = {
  left: {
    circle: { cx: 128, cy: 96, r: 72 },
    path: 'M8 280A88 88 0 0 1 96 192L192 192A30 30 0 0 1 222 222L222 278.54A118 60 0 0 0 264 395.86L264 488L156 488A148 148 0 0 1 8 340Z',
    monoPath:
      'M8 280A88 88 0 0 1 96 192L192 192A30 30 0 0 1 222 222L222 278.54A118 60 0 0 0 244 395.69L244 478A10 10 0 0 1 234 488L156 488A148 148 0 0 1 8 340Z',
  },
  right: {
    circle: { cx: 384, cy: 96, r: 72 },
    path: 'M504 280A88 88 0 0 0 416 192L320 192A30 30 0 0 0 290 222L290 278.54A118 60 0 0 1 256 396L256 488L356 488A148 148 0 0 0 504 340Z',
    monoPath:
      'M504 280A88 88 0 0 0 416 192L320 192A30 30 0 0 0 290 222L290 278.54A118 60 0 0 1 268 395.69L268 478A10 10 0 0 0 278 488L356 488A148 148 0 0 0 504 340Z',
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
