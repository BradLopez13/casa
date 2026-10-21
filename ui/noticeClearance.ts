import { MIN_TOUCH } from './tokens';

// Kept free of react-native imports (like `tabBar.ts`), so Vitest's unit project can load it.
const space = (n: number) => n * 4;

/**
 * The room a notice pill takes at the bottom of a tab screen: its touch height with its padding
 * (`Notice`), the air under it to the tab bar and the same air above it.
 */
export const NOTICE_CLEARANCE = MIN_TOUCH + space(2) + space(3) + space(3);

/** Room under the last item of a list: the base, plus the pill's while a notice shows. */
export function listEndPadding(base: number, noticeShown: boolean): number {
  return base + (noticeShown ? NOTICE_CLEARANCE : 0);
}

type Nudge = {
  /** The list's scroll offset. */
  offset: number;
  /** The height of the list's window. */
  viewport: number;
  /** The list's content height as laid out with the notice padding already in it. */
  content: number;
  /** The room under the last item without the notice (`useListEndPadding` before it showed). */
  basePadding: number;
};

/**
 * How far to scroll so the last note shows above the pill that just appeared over it: the pill
 * covers the end of the window, so a list that fills it moves up by what it had hidden. A short
 * list, or one already scrolled past its end, stays put.
 */
export function noticeNudge({ offset, viewport, content, basePadding }: Nudge): number {
  return Math.max(0, content - basePadding - viewport - offset);
}
