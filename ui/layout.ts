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
  return {
    size,
    landscape: width > height,
    shortHeight: height < 500,
    twoPane: wide,
    rail: wide,
    contentMax: wide ? 1200 : 640,
    gutter: GUTTER[size],
  };
}
