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
/**
 * About how tall the full door is at the default text size, status bar included (Hoy, the
 * tallest: title, date and household, magnets with names and counts). Its text grows with the
 * system's, so the estimate does too.
 */
const FULL_DOOR_HEIGHT = 300;

/**
 * How the door is drawn for this window: full height with its handle, or compact.
 *
 * Compact on a short window (a phone on its side). Above two panes the door is fixed outside any
 * scroll, so it also turns compact once the full door would take more than 40 % of the window,
 * which happens sooner with enlarged text. In one column the full door scrolls away with the list,
 * so there it may be as tall as it needs.
 */
export function doorFor(
  layout: Pick<Layout, 'shortHeight' | 'twoPane'>,
  windowHeight: number,
  titleSize: DoorTitleSize,
  fontScale = 1,
): Door {
  const fullDoor = FULL_DOOR_HEIGHT * Math.max(1, fontScale);
  const crowdsPanes = layout.twoPane && fullDoor > windowHeight * COMPACT_MAX_SHARE;
  if (!layout.shortHeight && !crowdsPanes) {
    return { compact: false, titleSize: TITLE_SIZES[titleSize], handle: true, maxHeight: null };
  }
  return {
    compact: true,
    titleSize: COMPACT_TITLE,
    handle: false,
    maxHeight: Math.floor(windowHeight * COMPACT_MAX_SHARE),
  };
}
