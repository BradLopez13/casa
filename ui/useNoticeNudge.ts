import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useNoticeNudges, useNoticeShown } from './components/noticeContext';
import { NOTICE_CLEARANCE, noticeScroll, wholeDoor } from './noticeClearance';
import { useReduceMotion } from './a11y';
import { DOOR_HANDLE_OVERHANG } from './tokens';
import { useBaseListEndPadding } from './useTabBarClearance';

/** Enough scroll events to know where the list is, without reporting every pixel. */
const SCROLL_THROTTLE_MS = 100;
/** Room added at the end beyond what the move needs, for the fractions of a dp in layout. */
const ROOM_SLACK = 1;
/** The door's top padding under the status bar (8 dp compact, 12 full): moving less cuts nothing. */
const DOOR_SLACK = 8;

/**
 * Keeps a tab list's last note in view when a notice pill appears over it («Hecha. Deshacer»
 * drawn on the note just completed). The list grows by the pill's room (`useListEndPadding`);
 * once that new size is laid out, the list scrolls by what the pill had hidden, and no more,
 * unless that would leave the door cut under the status bar: then it moves the door out whole,
 * with room added at the list's end while the notice lasts if the list is too short to get there
 * (`endPadding`). When the notice goes, a list nobody touched goes back to where it was; one that
 * was touched stays, unless the shrinking end would clip it into a cut door, and then the door
 * comes back whole (DESIGN.md, «la puerta nunca se ve partida»). A notice whose note left the
 * list (`NoticeAction.leftList`: completed into the tray, deleted) leaves the room and moves
 * nothing; a clip the list's own shrinking causes still never leaves the door cut.
 *
 * The door must be the first thing in the list's header. `scrollList` moves the list (a
 * SectionList through its scroll responder, a FlatList with `scrollToOffset`). Spread `listProps`
 * on the list, put `onDoorLayout` on the view around the door and add `endPadding` to the list's
 * bottom padding.
 */
export function useNoticeNudge(scrollList: (y: number, animated: boolean) => void) {
  const shown = useNoticeShown();
  // A notice whose note left the list (to the tray, deleted) leaves the room at the end but moves
  // nothing: there is nothing to uncover.
  const nudges = useNoticeNudges();
  const basePadding = useBaseListEndPadding();
  const reduceMotion = useReduceMotion();
  const [endPadding, setEndPadding] = useState(0);
  const offset = useRef(0);
  const viewport = useRef(0);
  const content = useRef(0);
  const door = useRef(0);
  // The notice just appeared: the next content size carries its padding, and that is when the
  // list knows how far to move.
  const pending = useRef(false);
  // Where the list was before the nudge and where the nudge takes it.
  const nudged = useRef<{ from: number; to: number } | null>(null);
  // Someone dragged the list while the notice was up: where it is now is theirs.
  const touched = useRef(false);
  // Whether a notice was up at the last effect, to tell a notice going from no notice at all.
  const showing = useRef(false);
  // The room at the end as laid out now: it lasts as long as the notice.
  const room = shown ? endPadding : 0;

  // What the callbacks and the hide read, as they are at that moment.
  const latest = useRef({ endPadding, scrollList, reduceMotion });
  useLayoutEffect(() => {
    latest.current = { endPadding, scrollList, reduceMotion };
  });
  const scrollTo = useCallback((y: number) => {
    latest.current.scrollList(y, !latest.current.reduceMotion);
  }, []);
  // Out whole means the handle too, which sits on the door's edge (seen on the .51).
  const doorNow = useCallback(
    () => ({ height: door.current + DOOR_HANDLE_OVERHANG, slack: DOOR_SLACK }),
    [],
  );

  useLayoutEffect(() => {
    pending.current = shown && nudges;
    const hid = showing.current && !shown;
    showing.current = shown;
    if (shown) {
      if (nudges) touched.current = false;
      return;
    }
    if (!hid) return;
    const was = nudged.current;
    nudged.current = null;
    // The end is about to lose the pill's room and any extra: the list must not be clipped into
    // a cut door by it, whether the notice moved it or not (one whose note left the list did not).
    const shrunk = content.current - NOTICE_CLEARANCE - latest.current.endPadding;
    const target = wholeDoor({
      offset: was !== null && !touched.current ? was.from : offset.current,
      furthest: Math.max(0, shrunk - viewport.current),
      door: doorNow(),
    });
    // Where the list already is stays untouched: a fling still running is the person's.
    if (Math.abs(target - offset.current) > 1) scrollTo(target);
  }, [shown, nudges, scrollTo, doorNow]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  }, []);
  const onScrollBeginDrag = useCallback(() => {
    touched.current = true;
  }, []);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    viewport.current = e.nativeEvent.layout.height;
  }, []);
  const onDoorLayout = useCallback((e: LayoutChangeEvent) => {
    door.current = e.nativeEvent.layout.height;
  }, []);
  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      content.current = height;
      // A list that shrinks under its offset is clamped to its new end with no scroll event
      // (Android): the last offset heard is no longer where it is. Taken as the list has it, or
      // a second change while the notice lasts (the note done going to «Hechas hoy») thought the
      // list was where it should be and left the door cut (crítica del 27, P1-1).
      const before = offset.current;
      offset.current = Math.min(before, Math.max(0, height - viewport.current));
      const clipped = offset.current < before;
      const was = nudged.current;
      // Nothing to work out (no notice moving the list, or one whose note left it replaced the
      // one that did): only a clip into a cut door is undone, by bringing the door back whole.
      if ((was === null && !pending.current) || (was !== null && !nudges)) {
        const cut = doorNow();
        if (clipped && offset.current > cut.slack && offset.current < cut.height) scrollTo(0);
        // The room an earlier notice asked for goes with it.
        if (!shown && endPadding !== 0) setEndPadding(0);
        return;
      }
      pending.current = false;
      // Worked out again from where the list was each time it changes while the notice lasts:
      // a note moving between sections, another one done, a refetch. Reopening from the tray
      // shrinks the list right after the notice shows, and then nothing needs moving any more.
      const from = was?.from ?? offset.current;
      const scroll = noticeScroll({
        offset: from,
        viewport: viewport.current,
        content: height - room,
        basePadding,
        door: doorNow(),
      });
      if (scroll === null) {
        nudged.current = null;
        if (was !== null && !touched.current && Math.abs(offset.current - from) > 1) {
          scrollTo(from);
        }
        return;
      }
      nudged.current = { from, to: scroll.to };
      // Laid out heights come in fractions of a dp: the room is rounded up with a dp to spare and
      // only grows when the list came out short, or it would never be «the same» (seen on the
      // .51). The list moves once the room it needs is there.
      const needed = Math.ceil(scroll.extra);
      if (needed > room) {
        // A dp to spare, so the list is never clipped just short of the door's edge.
        setEndPadding(needed + ROOM_SLACK);
        return;
      }
      if (!touched.current && Math.abs(offset.current - scroll.to) > 1) scrollTo(scroll.to);
    },
    [basePadding, endPadding, nudges, room, shown, scrollTo, doorNow],
  );

  return {
    listProps: {
      onScroll,
      onScrollBeginDrag,
      scrollEventThrottle: SCROLL_THROTTLE_MS,
      onLayout,
      onContentSizeChange,
    },
    onDoorLayout,
    endPadding: room,
  };
}
