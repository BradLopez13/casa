// Pure: no react-native import, so Vitest can check it.

/** The bottom bar's own height without the safe area, as React Navigation draws it. */
const TAB_BAR_HEIGHT = 49;

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
 * The bottom bar's height, safe area included, when the system text is enlarged and the label
 * sits under the icon: the bar's fixed 49 dp grows by what the label line gains (up to the 1.6
 * cap), so the label never runs into the gesture bar. At the default text size, or with the
 * labels beside the icons (one row, already roomy), `undefined` leaves React Navigation's own
 * height as it was.
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
  if (fontScale <= 1 || tabLabelsBeside(width, height)) return undefined;
  const scale = Math.min(fontScale, TAB_LABEL_MAX_SCALE);
  const growth = Math.ceil(TAB_LABEL_LINE * (scale - 1) - 1e-9);
  return TAB_BAR_HEIGHT + growth + bottomInset;
}
