import { act, render } from '@testing-library/react';
import { useLayoutEffect, useRef } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { describe, expect, it } from 'vitest';
import { NoticeNudgesContext, NoticeShownContext } from './components/noticeContext';
import { listEndPadding } from './noticeClearance';
import { DOOR_HANDLE_OVERHANG } from './tokens';
import { useNoticeNudge } from './useNoticeNudge';
import { useBaseListEndPadding } from './useTabBarClearance';

/**
 * The case the .51 showed and no test had (crítica del 27 de octubre, P1-1): text at 1.0, the list
 * at the top, the whole door (about 400 dp, with its handle) and a short list. Completing a note
 * shows «Hecha. Deshacer» and moves the note to «Hechas hoy», which is a second content size
 * change while the notice lasts. Heights in dp, as on the .51 (817 dp tall, the list over the tab
 * bar).
 */
const DOOR = 400;
const VIEWPORT = 730;
const QUICK_ADD = 76;
const HEADER = 40;
const SEPARATOR = 12;
const NOTE = 64;
const TALL_NOTE = 110;
const DONE_NOTE = 52;

/** Door, field, «De días anteriores» with two notes and «Hoy» with one. */
const OPEN = DOOR + QUICK_ADD + HEADER + NOTE + SEPARATOR + TALL_NOTE + HEADER + NOTE;
/** The «Hoy» note done: its section goes, «Hechas hoy» comes with the compact note. */
const COMPLETED = OPEN - HEADER - NOTE + HEADER + DONE_NOTE;

/**
 * A scroll view as Android draws it: `scrollTo` reports where it landed, and a content that
 * shrinks under the offset clamps it to the new end without any scroll event.
 */
class FakeScroll {
  offset = 0;
  content = 0;
  private onScroll: (y: number) => void = () => undefined;
  constructor(readonly viewport: number) {}
  listen(onScroll: (y: number) => void) {
    this.onScroll = onScroll;
  }
  get furthest() {
    return Math.max(0, this.content - this.viewport);
  }
  scrollTo(y: number) {
    this.offset = Math.min(Math.max(0, y), this.furthest);
    this.onScroll(this.offset);
  }
  resize(content: number) {
    this.content = content;
    if (this.offset > this.furthest) this.offset = this.furthest;
  }
}

const layout = (height: number) =>
  ({ nativeEvent: { layout: { x: 0, y: 0, width: 375, height } } }) as LayoutChangeEvent;
const scrolled = (y: number) =>
  ({ nativeEvent: { contentOffset: { x: 0, y } } }) as NativeSyntheticEvent<NativeScrollEvent>;

function List({ items, list, shown }: { items: number; list: FakeScroll; shown: boolean }) {
  const base = useBaseListEndPadding();
  const nudge = useNoticeNudge((y) => list.scrollTo(y));
  const content = items + listEndPadding(base, shown) + nudge.endPadding;
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      nudge.listProps.onLayout(layout(list.viewport));
      nudge.onDoorLayout(layout(DOOR));
      list.listen((y) => nudge.listProps.onScroll(scrolled(y)));
    }
    if (content !== list.content) {
      list.resize(content);
      nudge.listProps.onContentSizeChange(375, content);
    }
  });
  return null;
}

type Props = { items: number; list: FakeScroll; shown: boolean; leftList?: boolean };

function Screen({ leftList = false, ...props }: Props) {
  return (
    <NoticeShownContext.Provider value={props.shown}>
      <NoticeNudgesContext.Provider value={props.shown && !leftList}>
        <List {...props} />
      </NoticeNudgesContext.Provider>
    </NoticeShownContext.Provider>
  );
}

/** Whole inside (at most its top padding under the status bar) or whole outside, handle too. */
const doorWhole = (offset: number) => offset <= 8 || offset >= DOOR + DOOR_HANDLE_OVERHANG;

function setUp(items: number) {
  const list = new FakeScroll(VIEWPORT);
  const view = render(<Screen items={items} list={list} shown={false} />);
  const step = (next: Omit<Props, 'list'>) =>
    act(() => view.rerender(<Screen {...next} list={list} />));
  return { list, step };
}

describe('useNoticeNudge with the whole door and a short list', () => {
  it('leaves the door whole when the completed note moves to «Hechas hoy»', () => {
    const { list, step } = setUp(OPEN);
    step({ items: OPEN, shown: true });
    expect(doorWhole(list.offset)).toBe(true);
    step({ items: COMPLETED, shown: true });
    expect(doorWhole(list.offset)).toBe(true);
    step({ items: COMPLETED, shown: false });
    expect(doorWhole(list.offset)).toBe(true);
  });

  it('leaves the door whole when the list changes before the notice shows', () => {
    const { list, step } = setUp(OPEN);
    step({ items: COMPLETED, shown: false });
    step({ items: COMPLETED, shown: true });
    expect(doorWhole(list.offset)).toBe(true);
    step({ items: COMPLETED, shown: false });
    expect(doorWhole(list.offset)).toBe(true);
  });

  it('leaves the door whole when a note is reopened from the tray', () => {
    const { list, step } = setUp(COMPLETED);
    step({ items: COMPLETED, shown: true });
    step({ items: OPEN, shown: true });
    expect(doorWhole(list.offset)).toBe(true);
    step({ items: OPEN, shown: false });
    expect(doorWhole(list.offset)).toBe(true);
  });

  // Decisión 1 de Brad (27 de octubre, A): a note that left the list has nothing to uncover.
  it('does not move the list when the note completed went to the tray', () => {
    const { list, step } = setUp(OPEN);
    step({ items: OPEN, shown: true, leftList: true });
    step({ items: COMPLETED, shown: true, leftList: true });
    expect(list.offset).toBe(0);
    step({ items: COMPLETED, shown: false });
    expect(list.offset).toBe(0);
  });

  it('does not move the list when the note was deleted', () => {
    const { list, step } = setUp(OPEN);
    step({ items: OPEN, shown: true, leftList: true });
    step({ items: OPEN - HEADER - NOTE, shown: true, leftList: true });
    expect(list.offset).toBe(0);
  });

  it('keeps a list someone scrolled where they left it when the note leaves it', () => {
    const { list, step } = setUp(OPEN);
    act(() => list.scrollTo(60));
    step({ items: OPEN, shown: true, leftList: true });
    step({ items: COMPLETED, shown: true, leftList: true });
    expect(list.offset).toBe(60);
  });
});
