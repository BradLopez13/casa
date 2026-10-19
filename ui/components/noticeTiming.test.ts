import { describe, expect, it } from 'vitest';
import { NOTICE_ACTION_MS, NOTICE_MS, noticeDuration, noticeExpired } from './noticeTiming';

describe('noticeDuration', () => {
  it('lasts 4 s without an action', () => {
    expect(noticeDuration({ action: false, screenReader: false })).toBe(4000);
    expect(NOTICE_MS).toBe(4000);
  });

  it('lasts 5 s with an action, long enough to reach it', () => {
    expect(noticeDuration({ action: true, screenReader: false })).toBe(5000);
    expect(NOTICE_ACTION_MS).toBe(5000);
  });

  // WCAG 2.2.1: swiping to «Deshacer» with a screen reader takes as long as it takes.
  it('never times out an action while a screen reader is on', () => {
    expect(noticeDuration({ action: true, screenReader: true })).toBeNull();
  });

  it('keeps the plain notice timing with a screen reader', () => {
    expect(noticeDuration({ action: false, screenReader: true })).toBe(4000);
  });
});

describe('noticeExpired', () => {
  const a = { id: 1, hasAction: true };
  const b = { id: 2, hasAction: true };

  it('expires a notice with an action that leaves without its action', () => {
    expect(noticeExpired(a, null, null)).toBe(true);
    expect(noticeExpired(a, b, null)).toBe(true);
  });

  it('does not expire the notice whose action was used', () => {
    expect(noticeExpired(a, null, 1)).toBe(false);
  });

  it('does not expire a notice that is still the one shown (its timing changed)', () => {
    expect(noticeExpired(a, { id: 1, hasAction: true }, null)).toBe(false);
  });

  it('has nothing to expire without a previous notice or without an action', () => {
    expect(noticeExpired(null, a, null)).toBe(false);
    expect(noticeExpired({ id: 3, hasAction: false }, null, null)).toBe(false);
  });
});
