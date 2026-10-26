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

type Door = {
  /** The door's height at the head of the list (with anything stuck to it, the offline band). */
  height: number;
  /** Its top padding: the list can move this far before anything in the door is cut. */
  slack: number;
};

/**
 * Where to scroll so the pill clears the last note without ever leaving the door cut in half
 * under the status bar (DESIGN.md, «la puerta nunca se ve partida»). The least move that clears
 * the note (`noticeNudge`) is kept when the door stays whole, inside or out; when it would cut
 * the door, the list moves on until the door is out whole. A list too short to move that far
 * says how much room it needs at its end (`extra`). `null` when nothing needs moving.
 */
export function noticeScroll({ door, ...nudge }: Nudge & { door: Door }): {
  to: number;
  extra: number;
} | null {
  const by = noticeNudge(nudge);
  if (by === 0) return null;
  const least = nudge.offset + by;
  const cut = least > door.slack && least < door.height;
  const to = cut ? door.height : least;
  const furthest = Math.max(0, nudge.content - nudge.viewport);
  return { to, extra: Math.max(0, to - furthest) };
}

/**
 * Where a list ends up when its end shrinks (the notice going): where it should be (`offset`) if
 * the end still reaches it, the new end if not, and the top when that new end would leave the door
 * cut. A place the person scrolled to is theirs; a clip the app causes never cuts the door.
 */
export function wholeDoor({
  offset,
  furthest,
  door,
}: {
  offset: number;
  furthest: number;
  door: Door;
}): number {
  if (offset <= furthest) return offset;
  return furthest > door.slack && furthest < door.height ? 0 : furthest;
}
