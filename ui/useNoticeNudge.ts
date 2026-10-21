import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  SectionList,
} from 'react-native';
import { useNoticeShown } from './components/noticeContext';
import { noticeNudge } from './noticeClearance';
import { useBaseListEndPadding } from './useTabBarClearance';

/** Enough scroll events to know where the list is, without reporting every pixel. */
const SCROLL_THROTTLE_MS = 100;

/**
 * Keeps a tab list's last note in view when a notice pill appears over it («Hecha. Deshacer»
 * drawn on the note just completed). The list grows by the pill's room (`useListEndPadding`);
 * once that new size is laid out, the list scrolls by what the pill had hidden, and no more.
 * Spread the returned props on the `SectionList`.
 */
export function useNoticeNudge<ItemT, SectionT>(
  listRef: RefObject<SectionList<ItemT, SectionT> | null>,
) {
  const shown = useNoticeShown();
  const basePadding = useBaseListEndPadding();
  const offset = useRef(0);
  const viewport = useRef(0);
  // The notice just appeared: the next content size carries its padding, and that is when the
  // list knows how far to move.
  const pending = useRef(false);
  useLayoutEffect(() => {
    pending.current = shown;
  }, [shown]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  }, []);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    viewport.current = e.nativeEvent.layout.height;
  }, []);
  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      if (!pending.current) return;
      pending.current = false;
      const nudge = noticeNudge({
        offset: offset.current,
        viewport: viewport.current,
        content: height,
        basePadding,
      });
      if (nudge === 0) return;
      listRef.current
        ?.getScrollResponder()
        ?.scrollTo({ y: offset.current + nudge, animated: true });
    },
    [basePadding, listRef],
  );

  return { onScroll, scrollEventThrottle: SCROLL_THROTTLE_MS, onLayout, onContentSizeChange };
}
