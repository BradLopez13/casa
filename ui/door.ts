import type { Layout } from './layout';

/** The sizes of the door's hierarchy (§14.4): eyebrow, headline (its number larger), line. */
export type DoorType = {
  eyebrow: number;
  heading: number;
  lineHeight: number;
  /** The count inside a headline («Te tocan 2.», «Faltan 4 cosas.»), a point larger. */
  number: number;
  secondary: number;
};

export const DOOR_TYPE = {
  full: { eyebrow: 13, heading: 32, lineHeight: 38, number: 36, secondary: 16 },
  compact: { eyebrow: 12, heading: 24, lineHeight: 29, number: 27, secondary: 14 },
} as const satisfies Record<'full' | 'compact', DoorType>;

export type Door = {
  /** A short window (landscape phone): headline and controls share one row, no handle. */
  compact: boolean;
  type: DoorType;
  handle: boolean;
  /** Tallest the door may be, in dp; `null` when it may grow with its content. */
  maxHeight: number | null;
  /**
   * The quick add sits inside the door, under its controls: on a short window in one column,
   * where a field under the door would take the list's only row. Above two panes it stays put.
   */
  holdsQuickAdd: boolean;
};

/** Largest the door's own text grows with the system's: past it the list would have no room. */
export const DOOR_MAX_SCALE = 1.4;

/** Share of the window height a compact door may take, so the list keeps most of it. */
const COMPACT_MAX_SHARE = 0.4;
/**
 * From this text size a compact door's hierarchy, controls and day strip need more than 40 %:
 * the quick add then goes to the list and the door may take 45 %, so nothing in it is cut.
 */
export const LARGE_TEXT = 1.3;
const COMPACT_MAX_SHARE_LARGE_TEXT = 0.45;
/**
 * In one column the full door scrolls away with the list, so it may be taller than a fixed one:
 * only past half the window does it compact, a safety net for a low window. Its estimate does not
 * grow with the text there: the door's text is capped (`DOOR_MAX_SCALE`) and its magnets are
 * fixed, and on the .51 the full door of Hoy measures 292 dp at ×1,6 against 297 at ×1.
 */
const SCROLLING_MAX_SHARE = 0.5;
/**
 * About how tall the full door is at the default text size, status bar included (Hoy, the
 * tallest: eyebrow and date, headline, its second line, magnets with names). Its text grows with
 * the system's, so the estimate does too.
 */
const FULL_DOOR_HEIGHT = 300;

/**
 * How the door is drawn for this window: full height with its handle, or compact.
 *
 * Compact on a short window (a phone on its side). Above two panes the door is fixed outside any
 * scroll, so it also turns compact once the full door would take more than 40 % of the window,
 * which happens sooner with enlarged text. In one column the full door scrolls away with the list,
 * so it compacts by space too, but only past half the window: the door is measured by the room it
 * has, not by the phone's orientation.
 */
export function doorFor(
  layout: Pick<Layout, 'shortHeight' | 'twoPane'>,
  windowHeight: number,
  fontScale = 1,
): Door {
  const fullDoor = FULL_DOOR_HEIGHT * Math.min(Math.max(1, fontScale), DOOR_MAX_SCALE);
  const crowdsPanes = layout.twoPane && fullDoor > windowHeight * COMPACT_MAX_SHARE;
  const crowdsList = !layout.twoPane && FULL_DOOR_HEIGHT > windowHeight * SCROLLING_MAX_SHARE;
  if (!layout.shortHeight && !crowdsPanes && !crowdsList) {
    return {
      compact: false,
      type: DOOR_TYPE.full,
      handle: true,
      maxHeight: null,
      holdsQuickAdd: false,
    };
  }
  const largeText = fontScale >= LARGE_TEXT;
  return {
    compact: true,
    type: DOOR_TYPE.compact,
    handle: false,
    maxHeight: Math.floor(
      windowHeight * (largeText ? COMPACT_MAX_SHARE_LARGE_TEXT : COMPACT_MAX_SHARE),
    ),
    holdsQuickAdd: layout.shortHeight && !layout.twoPane && !largeText,
  };
}
