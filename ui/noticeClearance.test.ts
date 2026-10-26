import { describe, expect, it } from 'vitest';
import {
  listEndPadding,
  NOTICE_CLEARANCE,
  noticeNudge,
  noticeScroll,
  wholeDoor,
} from './noticeClearance';

describe('listEndPadding', () => {
  it('is the base room while there is no notice', () => {
    expect(listEndPadding(28, false)).toBe(28);
  });

  it('adds the notice pill and its air while one shows, so the last note can scroll clear', () => {
    expect(listEndPadding(28, true)).toBe(28 + NOTICE_CLEARANCE);
    // The pill (44 touch height plus its padding) with the air under and above it.
    expect(NOTICE_CLEARANCE).toBe(44 + 8 + 12 + 12);
  });
});

describe('noticeNudge', () => {
  // `content` is the list as laid out with the notice padding already in it.
  it('scrolls just enough for the last note to clear the pill when the list fills the window', () => {
    const content = 700 + NOTICE_CLEARANCE;
    expect(noticeNudge({ offset: 0, viewport: 700, content, basePadding: 28 })).toBe(
      content - 28 - 700,
    );
  });

  it('does nothing for a short list: the pill sits under empty page', () => {
    expect(noticeNudge({ offset: 0, viewport: 700, content: 400, basePadding: 28 })).toBe(0);
  });

  it('does nothing when the list is already scrolled past the note', () => {
    expect(noticeNudge({ offset: 300, viewport: 700, content: 900, basePadding: 28 })).toBe(0);
  });
});

describe('noticeScroll', () => {
  // A list 700 dp high whose header starts with a 280 dp door; its top 8 dp are padding, so the
  // label is only cut once the list moves past them.
  const door = { height: 280, slack: 8 };

  it('stays put when nothing needs moving', () => {
    expect(
      noticeScroll({ offset: 0, viewport: 700, content: 400, basePadding: 28, door }),
    ).toBeNull();
  });

  it('moves the door out whole when the nudge alone would leave it cut', () => {
    // The pill hides 60 dp of the last note: moving 60 would cut the door's label in half.
    const content = 700 + 60 + 28;
    const scroll = noticeScroll({ offset: 0, viewport: 700, content, basePadding: 28, door });
    expect(scroll?.to).toBe(280);
    // The list is 88 dp longer than its window: it needs 192 dp more at its end to get there.
    expect(scroll?.extra).toBe(280 - (content - 700));
  });

  it('asks for no extra room when the list is long enough to move the door out', () => {
    // From 100 dp down, the note needs 172: the door would still show its bottom 108.
    const content = 1000;
    const scroll = noticeScroll({ offset: 100, viewport: 700, content, basePadding: 28, door });
    expect(scroll).toEqual({ to: 280, extra: 0 });
  });

  it('moves only what the note needs when the door stays whole', () => {
    // Already scrolled past the door: it is out and stays out.
    expect(
      noticeScroll({ offset: 400, viewport: 700, content: 1200, basePadding: 28, door }),
    ).toEqual({ to: 472, extra: 0 });
    // A nudge within the door's top padding cuts nothing.
    expect(noticeScroll({ offset: 0, viewport: 700, content: 734, basePadding: 28, door })).toEqual(
      { to: 6, extra: 0 },
    );
  });

  it('treats a list without a measured door as it always did', () => {
    const content = 700 + NOTICE_CLEARANCE;
    expect(
      noticeScroll({
        offset: 0,
        viewport: 700,
        content,
        basePadding: 28,
        door: { height: 0, slack: 0 },
      }),
    ).toEqual({ to: content - 28 - 700, extra: 0 });
  });
});

describe('wholeDoor', () => {
  const door = { height: 280, slack: 8 };

  it('keeps where the list should be when its end still reaches it', () => {
    expect(wholeDoor({ offset: 0, furthest: 300, door })).toBe(0);
    // Wherever the person left it, even over the door: that is theirs.
    expect(wholeDoor({ offset: 120, furthest: 300, door })).toBe(120);
  });

  it('follows a shorter end when the door stays whole', () => {
    expect(wholeDoor({ offset: 500, furthest: 400, door })).toBe(400);
    expect(wholeDoor({ offset: 50, furthest: 5, door })).toBe(5);
  });

  it('brings the door back whole when a shorter end would clip it in half', () => {
    expect(wholeDoor({ offset: 300, furthest: 150, door })).toBe(0);
  });
});
