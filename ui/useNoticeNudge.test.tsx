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
 * bar); also the compact door of the phone on its side and the door with the offline band.
 */
const QUICK_ADD = 76;
const HEADER = 40;
const SEPARATOR = 12;
const NOTE = 64;
const TALL_NOTE = 110;
const DONE_NOTE = 52;

/** Field, «De días anteriores» with two notes and «Hoy» with one, under the door. */
const OPEN_LIST = QUICK_ADD + HEADER + NOTE + SEPARATOR + TALL_NOTE + HEADER + NOTE;
/** The «Hoy» note done: its section goes, «Hechas hoy» comes with the compact note. */
const COMPLETED_LIST = OPEN_LIST - HEADER - NOTE + HEADER + DONE_NOTE;

type Geometry = { name: string; door: number; viewport: number };
const WHOLE: Geometry = { name: 'the whole door', door: 400, viewport: 730 };
const GEOMETRIES: Geometry[] = [
  WHOLE,
  { name: 'the compact door on its side', door: 180, viewport: 300 },
  { name: 'the whole door with the offline band', door: 436, viewport: 730 },
];

/**
 * A scroll view as Android draws it: `scrollTo` reports where it landed, and a content that
 * shrinks under the offset clamps it to the new end without any scroll event. It counts what the
 * app asked of it.
 */
class FakeScroll {
  offset = 0;
  content = 0;
  asked = 0;
  private onScroll: (y: number) => void = () => undefined;
  private onDrag: () => void = () => undefined;
  constructor(
    readonly viewport: number,
    readonly door: number,
  ) {}
  listen(onScroll: (y: number) => void, onDrag: () => void) {
    this.onScroll = onScroll;
    this.onDrag = onDrag;
  }
  get furthest() {
    return Math.max(0, this.content - this.viewport);
  }
  scrollTo(y: number) {
    this.offset = Math.min(Math.max(0, y), this.furthest);
    this.onScroll(this.offset);
  }
  /** The app moving it. */
  ask(y: number) {
    this.asked += 1;
    this.scrollTo(y);
  }
  /** The person moving it. */
  drag(y: number) {
    this.onDrag();
    this.scrollTo(y);
  }
  resize(content: number) {
    this.content = content;
    if (this.offset > this.furthest) this.offset = this.furthest;
  }
  /** Whole inside (at most its top padding under the status bar) or whole outside, handle too. */
  get doorWhole() {
    return this.offset <= 8 || this.offset >= this.door + DOOR_HANDLE_OVERHANG;
  }
}

const layout = (height: number) =>
  ({ nativeEvent: { layout: { x: 0, y: 0, width: 375, height } } }) as LayoutChangeEvent;
const scrolled = (y: number) =>
  ({ nativeEvent: { contentOffset: { x: 0, y } } }) as NativeSyntheticEvent<NativeScrollEvent>;

function List({ items, list, shown }: { items: number; list: FakeScroll; shown: boolean }) {
  const base = useBaseListEndPadding();
  const nudge = useNoticeNudge((y) => list.ask(y));
  const content = list.door + items + listEndPadding(base, shown) + nudge.endPadding;
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      nudge.listProps.onLayout(layout(list.viewport));
      nudge.onDoorLayout(layout(list.door));
      list.listen(
        (y) => nudge.listProps.onScroll(scrolled(y)),
        () => nudge.listProps.onScrollBeginDrag(),
      );
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

function setUp(items: number, geometry = WHOLE) {
  const list = new FakeScroll(geometry.viewport, geometry.door);
  const view = render(<Screen items={items} list={list} shown={false} />);
  const step = (next: Omit<Props, 'list'>) =>
    act(() => view.rerender(<Screen {...next} list={list} />));
  return { list, step };
}

describe.each(GEOMETRIES)('useNoticeNudge with $name and a short list', (geometry) => {
  it('leaves the door whole when the note moves to «Hechas hoy» under a notice that moves', () => {
    const { list, step } = setUp(OPEN_LIST, geometry);
    step({ items: OPEN_LIST, shown: true });
    expect(list.doorWhole).toBe(true);
    step({ items: COMPLETED_LIST, shown: true });
    expect(list.doorWhole).toBe(true);
    step({ items: COMPLETED_LIST, shown: false });
    // Nobody touched it: back where it was.
    expect(list.offset).toBe(0);
  });

  it('leaves the door whole when the list changes before the notice shows', () => {
    const { list, step } = setUp(OPEN_LIST, geometry);
    step({ items: COMPLETED_LIST, shown: false });
    step({ items: COMPLETED_LIST, shown: true });
    expect(list.doorWhole).toBe(true);
    step({ items: COMPLETED_LIST, shown: false });
    expect(list.doorWhole).toBe(true);
  });

  it('leaves the door whole when a note is reopened from the tray', () => {
    const { list, step } = setUp(COMPLETED_LIST, geometry);
    step({ items: COMPLETED_LIST, shown: true });
    step({ items: OPEN_LIST, shown: true });
    expect(list.doorWhole).toBe(true);
    step({ items: OPEN_LIST, shown: false });
    expect(list.doorWhole).toBe(true);
  });

  it('brings the door back whole when the notice goes and the end clips a list at its end', () => {
    // Scrolled to the end, just past the door; a delete shrinks the list, and the notice going
    // takes its room too, so the end would stop the list with the door cut.
    const long = geometry.viewport + 2;
    const { list, step } = setUp(long, geometry);
    act(() => list.drag(list.furthest));
    expect(list.doorWhole).toBe(true);
    step({ items: long, shown: true, leftList: true });
    step({ items: long - HEADER - NOTE, shown: true, leftList: true });
    expect(list.doorWhole).toBe(true);
    step({ items: long - HEADER - NOTE, shown: false });
    expect(list.doorWhole).toBe(true);
  });
});

describe('useNoticeNudge with a notice whose note left the list (decisión 1, A)', () => {
  // Decisión 1 de Brad (27 de octubre, A): a note that left the list has nothing to uncover.
  it('does not move the list when the note completed went to the tray', () => {
    const { list, step } = setUp(OPEN_LIST);
    step({ items: OPEN_LIST, shown: true, leftList: true });
    step({ items: COMPLETED_LIST, shown: true, leftList: true });
    expect(list.offset).toBe(0);
    step({ items: COMPLETED_LIST, shown: false });
    expect(list.offset).toBe(0);
    expect(list.asked).toBe(0);
  });

  it('does not move the list when the note was deleted, nor when the notice goes', () => {
    const { list, step } = setUp(OPEN_LIST);
    step({ items: OPEN_LIST, shown: true, leftList: true });
    step({ items: OPEN_LIST - HEADER - NOTE, shown: true, leftList: true });
    step({ items: OPEN_LIST - HEADER - NOTE, shown: false });
    expect(list.asked).toBe(0);
  });

  it('keeps a list someone scrolled where they left it when the note leaves it', () => {
    const { list, step } = setUp(OPEN_LIST);
    act(() => list.drag(60));
    step({ items: OPEN_LIST, shown: true, leftList: true });
    step({ items: COMPLETED_LIST, shown: true, leftList: true });
    step({ items: COMPLETED_LIST, shown: false });
    expect(list.offset).toBe(60);
    expect(list.asked).toBe(0);
  });

  it('stops moving the list once a notice that moves is replaced by one that does not', () => {
    // Reopen a note (the list may move), then complete another before the notice goes.
    const { list, step } = setUp(COMPLETED_LIST);
    step({ items: COMPLETED_LIST, shown: true });
    step({ items: OPEN_LIST, shown: true });
    const asked = list.asked;
    step({ items: OPEN_LIST, shown: true, leftList: true });
    step({ items: COMPLETED_LIST, shown: true, leftList: true });
    expect(list.asked).toBe(asked);
    expect(list.doorWhole).toBe(true);
  });
});

describe('useNoticeNudge and the person', () => {
  it('does not move a list the person dragged during the notice when the notice goes', () => {
    const long = OPEN_LIST + 8 * NOTE;
    const { list, step } = setUp(long);
    step({ items: long, shown: true });
    const asked = list.asked;
    act(() => list.drag(450));
    step({ items: long, shown: false });
    expect(list.asked).toBe(asked);
    expect(list.offset).toBe(450);
  });
});
