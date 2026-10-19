import { describe, expect, it, vi } from 'vitest';
import { createDeferredClear } from './deferredClear';

/** A clock the test moves by hand. */
function fakeSchedule() {
  const timers: { at: number; fn: () => void; live: boolean }[] = [];
  let now = 0;
  const schedule = (fn: () => void, ms: number) => {
    const timer = { at: now + ms, fn, live: true };
    timers.push(timer);
    return () => {
      timer.live = false;
    };
  };
  const advance = (ms: number) => {
    now += ms;
    for (const timer of timers) {
      if (timer.live && timer.at <= now) {
        timer.live = false;
        timer.fn();
      }
    }
  };
  return { schedule, advance };
}

describe('createDeferredClear', () => {
  it('clears once when the undo window ends', () => {
    const clock = fakeSchedule();
    const commit = vi.fn();
    const clear = createDeferredClear({ commit, schedule: clock.schedule });
    clear.start(5000);
    expect(clear.pending()).toBe(true);
    clock.advance(4999);
    expect(commit).not.toHaveBeenCalled();
    clock.advance(1);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(clear.pending()).toBe(false);
    clock.advance(10000);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('undo inside the window keeps the bag', () => {
    const clock = fakeSchedule();
    const commit = vi.fn();
    const clear = createDeferredClear({ commit, schedule: clock.schedule });
    clear.start(5000);
    expect(clear.undo()).toBe(true);
    clock.advance(10000);
    expect(commit).not.toHaveBeenCalled();
    expect(clear.pending()).toBe(false);
  });

  it('undo after the window does nothing', () => {
    const clock = fakeSchedule();
    const commit = vi.fn();
    const clear = createDeferredClear({ commit, schedule: clock.schedule });
    clear.start(5000);
    clock.advance(5000);
    expect(clear.undo()).toBe(false);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('flush clears at once (leaving the screen), and only once', () => {
    const clock = fakeSchedule();
    const commit = vi.fn();
    const clear = createDeferredClear({ commit, schedule: clock.schedule });
    clear.flush();
    expect(commit).not.toHaveBeenCalled();
    clear.start(5000);
    clear.flush();
    expect(commit).toHaveBeenCalledTimes(1);
    clock.advance(5000);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('a second start clears the first one before waiting again', () => {
    const clock = fakeSchedule();
    const commit = vi.fn();
    const clear = createDeferredClear({ commit, schedule: clock.schedule });
    clear.start(5000);
    clock.advance(1000);
    clear.start(5000);
    expect(commit).toHaveBeenCalledTimes(1);
    clock.advance(5000);
    expect(commit).toHaveBeenCalledTimes(2);
  });
});
