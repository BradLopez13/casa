export type SizeClass = 'compact' | 'medium' | 'expanded' | 'large';

export type Layout = {
  size: SizeClass;
  landscape: boolean;
  shortHeight: boolean;
  twoPane: boolean;
  rail: boolean;
  contentMax: number;
  gutter: number;
};

export const RAIL_WIDTH = 88;
export const SHEET_WIDTH = 560;
/** Widest a single column of content gets, on any screen. */
export const ONE_COLUMN_MAX = 640;
/** Widest a pair of panes gets, side by side. */
const TWO_PANE_MAX = 1200;

const GUTTER: Record<SizeClass, number> = { compact: 20, medium: 24, expanded: 32, large: 48 };

export function paneGap(size: SizeClass): number {
  return size === 'large' ? 48 : 32;
}

function sizeClassFor(width: number): SizeClass {
  if (width >= 1200) return 'large';
  if (width >= 840) return 'expanded';
  if (width >= 600) return 'medium';
  return 'compact';
}

export function layoutFor(width: number, height: number): Layout {
  const size = sizeClassFor(width);
  const wide = size === 'expanded' || size === 'large';
  const landscape = width > height;
  const shortHeight = height < 500;
  return {
    size,
    landscape,
    shortHeight,
    twoPane: wide,
    // A phone on its side runs out of height, not width: the rail gives the bar's row back.
    rail: wide || (landscape && shortHeight),
    contentMax: wide ? TWO_PANE_MAX : ONE_COLUMN_MAX,
    gutter: GUTTER[size],
  };
}

/**
 * Whether the sign-in screens set their slate band at the side and the form in two columns: on a
 * phone on its side, where a stacked form puts its main button under the fold.
 */
export function authBeside(layout: Pick<Layout, 'shortHeight' | 'landscape'>): boolean {
  return layout.shortHeight && layout.landscape;
}
