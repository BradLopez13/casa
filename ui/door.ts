import type { Layout } from './layout';

export type DoorTitleSize = 'large' | 'medium';

export type Door = {
  /** A short window (landscape phone): title and controls share one row, no handle. */
  compact: boolean;
  titleSize: number;
  handle: boolean;
  /** Tallest the door may be, in dp; `null` when it may grow with its content. */
  maxHeight: number | null;
};

const TITLE_SIZES: Record<DoorTitleSize, number> = { large: 44, medium: 38 };
const COMPACT_TITLE = 28;
/** Share of the window height a compact door may take, so the list keeps most of it. */
const COMPACT_MAX_SHARE = 0.4;

/** How the door is drawn for this window: full height with its handle, or compact. */
export function doorFor(
  layout: Pick<Layout, 'shortHeight'>,
  windowHeight: number,
  titleSize: DoorTitleSize,
): Door {
  if (!layout.shortHeight) {
    return { compact: false, titleSize: TITLE_SIZES[titleSize], handle: true, maxHeight: null };
  }
  return {
    compact: true,
    titleSize: COMPACT_TITLE,
    handle: false,
    maxHeight: Math.floor(windowHeight * COMPACT_MAX_SHARE),
  };
}
