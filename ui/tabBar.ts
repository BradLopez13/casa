// Pure: no react-native import, so Vitest can check it.
import { magnetSizes } from './tokens';

/** The pósit under the active tab's icon, in dp: the 24 dp icon sits in its middle. */
export const TAB_MAGNET = magnetSizes.tab;

/** The label's line at the default text size, in dp. */
export const TAB_LABEL_LINE = 16;

/** Room above and below the tab's content inside the bar, in dp. */
export const TAB_BAR_PAD = 4;

/**
 * The bottom bar's own height without the safe area, with the label under the icon: the 40 dp
 * pósit, the 16 dp label line and the padding around them.
 */
export const TAB_BAR_HEIGHT = TAB_BAR_PAD + TAB_MAGNET + TAB_LABEL_LINE + TAB_BAR_PAD;

/** The bar's height with the label beside the icon (one row, as tall as the pósit and its padding). */
export const TAB_BAR_BESIDE_HEIGHT = TAB_BAR_PAD + TAB_MAGNET + TAB_BAR_PAD;

/** Space between the pósit and a label that sits beside it, in dp. */
export const TAB_LABEL_GAP = 8;

/** Largest the tab labels grow with the system text: the same cap as the navigation rail. */
export const TAB_LABEL_MAX_SCALE = 1.6;

/**
 * Whether the bottom bar sets its labels beside the icons, as React Navigation decides it for
 * four tabs: on a tablet (768 dp and up, where four tabs of 125 dp fit) or on a phone on its side.
 */
export function tabLabelsBeside(width: number, height: number): boolean {
  return width >= 768 || width > height;
}

/**
 * The bottom bar's height, safe area included. With the label under the icon, the 64 dp bar
 * grows by what the label line gains with enlarged system text (up to the 1.6 cap), so the label
 * never runs into the gesture bar. With the labels beside the icons the row is as tall as the
 * pósit, which already holds the largest label line (16 × 1.6 = 26 dp).
 */
export function tabBarHeight({
  width,
  height,
  fontScale,
  bottomInset,
}: {
  width: number;
  height: number;
  fontScale: number;
  bottomInset: number;
}): number {
  if (tabLabelsBeside(width, height)) return TAB_BAR_BESIDE_HEIGHT + bottomInset;
  const scale = Math.min(Math.max(fontScale, 1), TAB_LABEL_MAX_SCALE);
  const growth = Math.ceil(TAB_LABEL_LINE * (scale - 1) - 1e-9);
  return TAB_BAR_HEIGHT + growth + bottomInset;
}

/**
 * How far from the screen's bottom edge something floating must sit to clear the tab bar: the
 * bar's height with the safe area when it is at the bottom; only the bottom inset when the
 * side rail takes its place.
 */
export function tabBarClearance({
  width,
  height,
  fontScale,
  bottomInset,
  rail,
}: {
  width: number;
  height: number;
  fontScale: number;
  bottomInset: number;
  rail: boolean;
}): number {
  if (rail) return bottomInset;
  return tabBarHeight({ width, height, fontScale, bottomInset });
}
