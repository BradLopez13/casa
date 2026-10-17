// Pure: no react-native import, so Vitest can check it.

/** The active tab's tonal pill, in dp: tall enough to hold the 24 dp icon with room around it. */
export const TAB_PILL_HEIGHT = 32;

/**
 * The bottom bar's own height without the safe area. React Navigation's 49 dp assumed a 28 dp
 * icon; the pill is 32 dp tall, so the bar gains those 4 dp to keep pill and label unclipped.
 */
export const TAB_BAR_HEIGHT = 53;

/** Space between the pill and a label that sits beside it, in dp. */
export const TAB_LABEL_GAP = 8;

/** The pill's width: around the icon alone when the label is beside it, a wider capsule under it. */
export function tabPillWidth(labelBeside: boolean): number {
  return labelBeside ? 40 : 64;
}

/** The label's line at the default text size, in dp. */
export const TAB_LABEL_LINE = 16;

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
 * The bottom bar's height, safe area included, when the label sits under the icon: the 53 dp bar
 * (room for the 32 dp pill and the label line) grows by what the label line gains with enlarged
 * system text (up to the 1.6 cap), so the label never runs into the gesture bar. With the labels
 * beside the icons (one row, already roomy), `undefined` leaves React Navigation's own height.
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
}): number | undefined {
  if (tabLabelsBeside(width, height)) return undefined;
  const scale = Math.min(Math.max(fontScale, 1), TAB_LABEL_MAX_SCALE);
  const growth = Math.ceil(TAB_LABEL_LINE * (scale - 1) - 1e-9);
  return TAB_BAR_HEIGHT + growth + bottomInset;
}
