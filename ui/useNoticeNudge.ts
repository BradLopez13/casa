import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  SectionList,
} from 'react-native';
import { useNoticeShown } from './components/noticeContext';
import { noticeScroll } from './noticeClearance';
import { useReduceMotion } from './a11y';
import { useBaseListEndPadding } from './useTabBarClearance';

/** Enough scroll events to know where the list is, without reporting every pixel. */
const SCROLL_THROTTLE_MS = 100;
/** The door's top padding under the status bar (8 dp compact, 12 full): moving less cuts nothing. */
const DOOR_SLACK = 8;
/** A list still within this of where the nudge left it has not been scrolled by anyone. */
const UNTOUCHED = 4;

/**
 * Keeps a tab list's last note in view when a notice pill appears over it («Hecha. Deshacer»
 * drawn on the note just completed). The list grows by the pill's room (`useListEndPadding`);
 * once that new size is laid out, the list scrolls by what the pill had hidden, and no more,
 * unless that would leave the door cut under the status bar: then it moves the door out whole,
 * with room added at the list's end if it is too short to get there (`endPadding`). When the
 * notice goes, a list nobody touched goes back to where it was, so the shrinking end never clips
 * it into a cut door either (DESIGN.md, «la puerta nunca se ve partida»).
 *
 * Spread `listProps` on the `SectionList`, put `onDoorLayout` on the view around the door and add
 * `endPadding` to the list's bottom padding.
 */
export function useNoticeNudge<ItemT, SectionT>(
  listRef: RefObject<SectionList<ItemT, SectionT> | null>,
) {
  const shown = useNoticeShown();
  const basePadding = useBaseListEndPadding();
  const reduceMotion = useReduceMotion();
  const [endPadding, setEndPadding] = useState(0);
  const offset = useRef(0);
  const viewport = useRef(0);
  const door = useRef(0);
  // The notice just appeared: the next content size carries its padding, and that is when the
  // list knows how far to move.
  const pending = useRef(false);
  // Where the list goes once the extra room at its end is laid out.
  const awaiting = useRef<number | null>(null);
  // Where the list was before the nudge and where the nudge left it.
  const nudged = useRef<{ from: number; to: number } | null>(null);

  const scrollTo = useCallback(
    (y: number) => {
      listRef.current?.getScrollResponder()?.scrollTo({ y, animated: !reduceMotion });
    },
    [listRef, reduceMotion],
  );

  useLayoutEffect(() => {
    pending.current = shown;
    if (shown) return;
    awaiting.current = null;
    const was = nudged.current;
    nudged.current = null;
    if (was && Math.abs(offset.current - was.to) <= UNTOUCHED) scrollTo(was.from);
  }, [shown, scrollTo]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  }, []);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    viewport.current = e.nativeEvent.layout.height;
  }, []);
  const onDoorLayout = useCallback((e: LayoutChangeEvent) => {
    door.current = e.nativeEvent.layout.height;
  }, []);
  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      if (awaiting.current !== null) {
        const to = awaiting.current;
        awaiting.current = null;
        scrollTo(to);
        return;
      }
      if (!pending.current) return;
      pending.current = false;
      // The room an earlier notice asked for is laid out again with this one until it changes.
      const room = endPadding;
      const scroll = noticeScroll({
        offset: offset.current,
        viewport: viewport.current,
        content: height - room,
        basePadding,
        door: { height: door.current, slack: DOOR_SLACK },
      });
      setEndPadding(scroll?.extra ?? 0);
      if (scroll === null) return;
      nudged.current = { from: offset.current, to: scroll.to };
      // A new room is laid out first; the list moves once it is there.
      if (scroll.extra !== room) {
        awaiting.current = scroll.to;
        return;
      }
      scrollTo(scroll.to);
    },
    [basePadding, endPadding, scrollTo],
  );

  return {
    listProps: { onScroll, scrollEventThrottle: SCROLL_THROTTLE_MS, onLayout, onContentSizeChange },
    onDoorLayout,
    // The extra room lasts as long as the notice.
    endPadding: shown ? endPadding : 0,
  };
}
