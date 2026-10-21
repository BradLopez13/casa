import { describe, expect, it } from 'vitest';
import { listEndPadding, NOTICE_CLEARANCE, noticeNudge } from './noticeClearance';

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
