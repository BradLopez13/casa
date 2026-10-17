import { describe, expect, it } from 'vitest';
import { NOTICE_ACTION_MS, NOTICE_MS, noticeDuration } from './noticeTiming';

describe('noticeDuration', () => {
  it('lasts 4 s without an action', () => {
    expect(noticeDuration({ action: false })).toBe(4000);
    expect(NOTICE_MS).toBe(4000);
  });

  it('lasts 5 s with an action, long enough to reach it', () => {
    expect(noticeDuration({ action: true })).toBe(5000);
    expect(NOTICE_ACTION_MS).toBe(5000);
  });
});
