import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useNoticeShown } from './components/noticeContext';
import { NOTICE_CLEARANCE, noticeScroll, wholeDoor } from './noticeClearance';
import { useReduceMotion } from './a11y';
import { useBaseListEndPadding } from './useTabBarClearance';

/** Enough scroll events to know where the list is, without reporting every pixel. */
const SCROLL_THROTTLE_MS = 100;
/** Room at the end that differs by less than this is the same room. */
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
 * comes back whole (DESIGN.md, «la puerta nunca se ve partida»).
 *
 * The door must be the first thing in the list's header. `scrollList` moves the list (a
 * SectionList through its scroll responder, a FlatList with `scrollToOffset`). Spread `listProps`
 * on the list, put `onDoorLayout` on the view around the door and add `endPadding` to the list's
 * bottom padding.
 */
export function useNoticeNudge(scrollList: (y: number, animated: boolean) => void) {
  const shown = useNoticeShown();
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
  // Where the list was before the nudge, where the nudge takes it, and whether it has got there.
  const nudged = useRef<{ from: number; to: number; arrived: boolean } | null>(null);
  // Someone dragged the list while the notice was up: where it is now is theirs.
  const touched = useRef(false);
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

  useLayoutEffect(() => {
    pending.current = shown;
    if (shown) {
      touched.current = false;
      return;
    }
    const was = nudged.current;
    nudged.current = null;
    if (was === null) return;
    // The end is about to lose the pill's room and any extra: the list must not be clipped into
    // a cut door by it.
    const shrunk = content.current - NOTICE_CLEARANCE - latest.current.endPadding;
    const target = wholeDoor({
      offset: touched.current ? offset.current : was.from,
      furthest: Math.max(0, shrunk - viewport.current),
      door: { height: door.current, slack: DOOR_SLACK },
    });
    if (Math.abs(target - offset.current) > 1) scrollTo(target);
  }, [shown, scrollTo]);

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
      const was = nudged.current;
      if (was !== null) {
        // While the notice lasts the list may change under it (another note done, a refetch):
        // the room at the end follows, so where the nudge goes stays reachable.
        // Laid out heights come in fractions of a dp: only a list that came out short asks for
        // more room, and the room is rounded up, or it would never be «the same» (seen on the .51).
        const needed = Math.ceil(Math.max(0, was.to - (height - room - viewport.current)));
        if (needed > room + ROOM_SLACK) {
          setEndPadding(needed);
          return;
        }
        if (!was.arrived && !touched.current) {
          was.arrived = true;
          scrollTo(was.to);
        }
        return;
      }
      if (!pending.current) {
        // The room an earlier notice asked for goes with it.
        if (!shown && endPadding !== 0) setEndPadding(0);
        return;
      }
      pending.current = false;
      const scroll = noticeScroll({
        offset: offset.current,
        viewport: viewport.current,
        content: height - room,
        basePadding,
        door: { height: door.current, slack: DOOR_SLACK },
      });
      if (scroll === null) return;
      const arrived = Math.ceil(scroll.extra) <= room + ROOM_SLACK;
      nudged.current = { from: offset.current, to: scroll.to, arrived };
      // A new room is laid out first; the list moves once it is there.
      if (!arrived) {
        setEndPadding(Math.ceil(scroll.extra));
        return;
      }
      scrollTo(scroll.to);
    },
    [basePadding, endPadding, room, shown, scrollTo],
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
