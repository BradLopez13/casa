import { onlineManager } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/data/supabase/errors';
import {
  markOnline,
  NETWORK_RETRY_LIMIT,
  NETWORK_RETRY_MAX_MS,
  abandonQueued,
  queuedFn,
  RECONNECT_RETRY_MS,
  RECONNECT_WINDOW_MS,
  retryDelayOnNetwork,
  retryOnNetwork,
  refreshSessionWith,
  isParked,
  retryQueuedNow,
  setQueueWaiter,
} from './retry';

describe('retryOnNetwork', () => {
  // Bloque 11 (T1): a connection that hangs without failing (a captive portal, a weak signal) used
  // to spend ten retries in about five minutes and drop the change. A change that never reached
  // the server is never given up on.
  it('keeps a change that did not reach the server for a week of tries', () => {
    expect(retryOnNetwork(0, new AppError('NETWORK'))).toBe(true);
    expect(retryOnNetwork(10, new AppError('NETWORK'))).toBe(true);
    expect(retryOnNetwork(NETWORK_RETRY_LIMIT - 1, new AppError('NETWORK'))).toBe(true);
    // A request that never gets through frees the queue behind it after a week.
    expect(retryOnNetwork(NETWORK_RETRY_LIMIT, new AppError('NETWORK'))).toBe(false);
    expect(NETWORK_RETRY_LIMIT).toBe(40_320);
  });

  it('takes any answer from the server as final', () => {
    expect(retryOnNetwork(0, new AppError('INVALID_ITEM_NAME'))).toBe(false);
    expect(retryOnNetwork(0, new AppError('UNKNOWN'))).toBe(false);
  });

  // Bloque 13 (P2-2): ten items ticked in the supermarket, a 503 during a deploy on the way back.
  it('tries again what a server that could not answer said', () => {
    expect(retryOnNetwork(0, new AppError('UNKNOWN', undefined, { status: 503 }))).toBe(true);
    expect(retryOnNetwork(3, new AppError('UNKNOWN', undefined, { serverCode: '40001' }))).toBe(
      true,
    );
  });
});

describe('retryDelayOnNetwork', () => {
  it('waits longer each time, up to 15 s', () => {
    markOnline(0);
    const later = RECONNECT_WINDOW_MS + 1;
    expect(retryDelayOnNetwork(0, undefined, later)).toBe(1000);
    expect(retryDelayOnNetwork(1, undefined, later)).toBe(2000);
    expect(retryDelayOnNetwork(3, undefined, later)).toBe(8000);
    expect(retryDelayOnNetwork(20, undefined, later)).toBe(NETWORK_RETRY_MAX_MS);
    expect(NETWORK_RETRY_MAX_MS).toBe(15_000);
  });

  // Bloque 13 (P3-1): «online» comes before the internet does, the first tries fail and the
  // doubling waits used to add up to 30–40 s before the queue went.
  it('tries again every second for a while after the connection comes back', () => {
    markOnline(1_000_000);
    expect(retryDelayOnNetwork(6, undefined, 1_000_000 + 5_000)).toBe(RECONNECT_RETRY_MS);
    expect(retryDelayOnNetwork(6, undefined, 1_000_000 + RECONNECT_WINDOW_MS - 1)).toBe(
      RECONNECT_RETRY_MS,
    );
    expect(retryDelayOnNetwork(6, undefined, 1_000_000 + RECONNECT_WINDOW_MS + 1)).toBe(
      NETWORK_RETRY_MAX_MS,
    );
    expect(RECONNECT_RETRY_MS).toBe(1000);
  });
});

describe('queuedFn', () => {
  // Bloque 14.1 (T5): «Reintentar» only resumed what was paused; a change waiting between two tries
  // waited for the timer already set, up to 15 s. The wait now lives in the change's own function,
  // where «Reintentar» and the connection coming back cut it short.
  it('goes at once the first time and waits between tries', async () => {
    vi.useFakeTimers();
    try {
      markOnline(-RECONNECT_WINDOW_MS);
      const calls: number[] = [];
      const fn = queuedFn((_vars: { id: string }) => {
        calls.push(Date.now());
        return Promise.resolve();
      });
      const vars = { id: 'a' };
      const run = {};
      const start = Date.now();
      await fn(vars, run);
      expect(calls).toEqual([start]);
      const second = fn(vars, run);
      await vi.advanceTimersByTimeAsync(999);
      expect(calls).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1);
      await second;
      expect(calls).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('tries again at once when asked (Reintentar) or when the connection comes back', async () => {
    vi.useFakeTimers();
    try {
      markOnline(-RECONNECT_WINDOW_MS);
      let calls = 0;
      const fn = queuedFn((_vars: object) => {
        calls++;
        return Promise.resolve();
      });
      const vars = {};
      const run = {};
      await fn(vars, run);
      const second = fn(vars, run);
      await vi.advanceTimersByTimeAsync(1000);
      await second;
      const third = fn(vars, run);
      await vi.advanceTimersByTimeAsync(100);
      expect(calls).toBe(2);
      retryQueuedNow();
      await vi.advanceTimersByTimeAsync(0);
      await third;
      expect(calls).toBe(3);
      const fourth = fn(vars, run);
      await vi.advanceTimersByTimeAsync(100);
      expect(calls).toBe(3);
      markOnline();
      await vi.advanceTimersByTimeAsync(0);
      await fourth;
      expect(calls).toBe(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts over on a new run (a change sent again after a restart, a direct call)', async () => {
    let calls = 0;
    const fn = queuedFn((_vars: object) => {
      calls++;
      return Promise.resolve();
    });
    const vars = {};
    await fn(vars, {});
    await fn(vars, {});
    await fn(vars);
    await fn(vars);
    expect(calls).toBe(4);
  });
});

describe('queuedFn after a pause', () => {
  // Revisión de 14.1: the wait used to run again after a pause, as if no time had passed.
  it('waits only what is left of the wait since the last try ended', async () => {
    vi.useFakeTimers();
    try {
      markOnline(-RECONNECT_WINDOW_MS);
      let calls = 0;
      const fn = queuedFn((_vars: object) => {
        calls++;
        return Promise.resolve();
      });
      const run = {};
      await fn({}, run);
      const second = fn({}, run);
      await vi.advanceTimersByTimeAsync(1000);
      await second;
      // Two tries done; the next would wait 2 s. The app was away for a minute.
      vi.advanceTimersByTime(60_000);
      const third = fn({}, run);
      await vi.advanceTimersByTimeAsync(0);
      await third;
      expect(calls).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('a 401 asks for a fresh token (bloque 14.4, T1)', () => {
  it('keeps the change and refreshes the session, at most once every 5 s', () => {
    const refresh = vi.fn();
    refreshSessionWith(refresh);
    const expired = new AppError('UNKNOWN', undefined, { status: 401, serverCode: 'PGRST303' });
    expect(retryOnNetwork(0, expired)).toBe(true);
    expect(retryOnNetwork(1, expired)).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(retryOnNetwork(0, new AppError('NETWORK'))).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);
    refreshSessionWith(() => undefined);
  });
});

describe('a queued change taken out of the cache (bloque 14.4, T6)', () => {
  // Removing a mutation from TanStack's cache does not stop its retries: after leaving a
  // household its change went on and failed with NOT_A_MEMBER and a notice.
  it('never reaches the server again, and fails as dropped (no notice, no report)', async () => {
    const send = vi.fn(() => Promise.resolve());
    const fn = queuedFn(send);
    const vars = { id: 'a' };
    abandonQueued({ state: { variables: vars } });
    await expect(fn(vars, {})).rejects.toMatchObject({ code: 'QUEUE_DROPPED' });
    expect(send).not.toHaveBeenCalled();
  });
});

describe('a queued change taken out of the cache while it waits between tries (revisión 14.4)', () => {
  it('does not go when the wait ends', async () => {
    vi.useFakeTimers();
    try {
      markOnline(-RECONNECT_WINDOW_MS);
      const send = vi.fn(() => Promise.resolve());
      const fn = queuedFn(send);
      const vars = { id: 'b' };
      const run = {};
      await fn(vars, run);
      const second = fn(vars, run).then(
        () => null,
        (error: unknown) => error,
      );
      // Waiting its second; the household is left meanwhile.
      abandonQueued({ state: { variables: vars } });
      await vi.advanceTimersByTimeAsync(1000);
      expect(await second).toMatchObject({ code: 'QUEUE_DROPPED' });
      expect(send).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

// Bloque 15.1 (P2-6): the server's NOT_AUTHENTICATED with the person still signed in is the 401
// in another coat: the change stays and a token is asked for.
describe('a NOT_AUTHENTICATED from the server with someone signed in', () => {
  it('keeps the change and refreshes the session', async () => {
    const { setSessionUser } = await import('./sessionUser');
    const refresh = vi.fn();
    refreshSessionWith(refresh);
    setSessionUser('ana');
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 60_000);
    try {
      expect(retryOnNetwork(0, new AppError('NOT_AUTHENTICATED'))).toBe(true);
      expect(refresh).toHaveBeenCalledTimes(1);
      // A change let go of locally is not the server's answer: it never goes again.
      expect(retryOnNetwork(0, new AppError('QUEUE_DROPPED'))).toBe(false);
    } finally {
      vi.useRealTimers();
      setSessionUser(undefined);
      refreshSessionWith(() => undefined);
    }
  });
});

// Bloque 15.1, prueba en el .51 del 4 de noviembre: with the app behind, Android delivers the
// network events and the answers to JS, but no JS timer fires (React Native's
// JavaTimerManager stops them on host pause). TanStack sleeps on a timer before every retry, so a
// change whose first try failed (the handover from mobile data to wifi) waited for the app to be
// opened. The tries now live inside the change's function, with a wait that the app can replace
// by a native one.
describe('a queued change tries again on its own (bloque 15.1, revisión en el .51)', () => {
  afterEach(() => {
    setQueueWaiter(undefined);
    onlineManager.setOnline(true);
    vi.useRealTimers();
  });

  it('tries again after a network failure without handing it back to TanStack', async () => {
    vi.useFakeTimers();
    markOnline(-RECONNECT_WINDOW_MS);
    let calls = 0;
    const fn = queuedFn((_vars: object) => {
      calls++;
      return calls === 1 ? Promise.reject(new AppError('NETWORK')) : Promise.resolve('ok');
    });
    const run = fn({}, {});
    await vi.advanceTimersByTimeAsync(999);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await run).toBe('ok');
    expect(calls).toBe(2);
  });

  it('takes any answer from the server as final, at once', async () => {
    let calls = 0;
    const fn = queuedFn((_vars: object) => {
      calls++;
      return Promise.reject(new AppError('INVALID_TITLE'));
    });
    await expect(fn({}, {})).rejects.toMatchObject({ code: 'INVALID_TITLE' });
    expect(calls).toBe(1);
  });

  it('waits for the connection inside, and goes on as soon as it is back', async () => {
    vi.useFakeTimers();
    markOnline(-RECONNECT_WINDOW_MS);
    let calls = 0;
    const fn = queuedFn((_vars: object) => {
      calls++;
      return calls === 1 ? Promise.reject(new AppError('NETWORK')) : Promise.resolve('ok');
    });
    const run = fn({}, {});
    await vi.advanceTimersByTimeAsync(0);
    onlineManager.setOnline(false);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(calls).toBe(1);
    onlineManager.setOnline(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(await run).toBe('ok');
    expect(calls).toBe(2);
  });

  it('waits with the waiter the app gives it (behind, a native one on Android)', async () => {
    markOnline(-RECONNECT_WINDOW_MS);
    const waits: number[] = [];
    let release: () => void = () => undefined;
    setQueueWaiter((ms) => {
      waits.push(ms);
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    let calls = 0;
    const fn = queuedFn((_vars: object) => {
      calls++;
      return calls === 1 ? Promise.reject(new AppError('NETWORK')) : Promise.resolve('ok');
    });
    const run = fn({}, {});
    await vi.waitFor(() => expect(waits).toEqual([RECONNECT_RETRY_MS]));
    expect(calls).toBe(1);
    release();
    expect(await run).toBe('ok');
    expect(calls).toBe(2);
  });

  it('gives up after the limit of tries', async () => {
    vi.useFakeTimers();
    markOnline(-RECONNECT_WINDOW_MS);
    let calls = 0;
    const fn = queuedFn((_vars: object) => {
      calls++;
      return Promise.reject(new AppError('NETWORK'));
    });
    const run = fn({}, {}).then(
      () => null,
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(NETWORK_RETRY_LIMIT * NETWORK_RETRY_MAX_MS + 60_000);
    expect(await run).toMatchObject({ code: 'NETWORK' });
    expect(calls).toBe(NETWORK_RETRY_LIMIT + 1);
  });

  it('a change let go of while it waits for the connection never goes again', async () => {
    vi.useFakeTimers();
    markOnline(-RECONNECT_WINDOW_MS);
    const send = vi.fn(() => Promise.reject(new AppError('NETWORK')));
    const fn = queuedFn(send);
    const vars = { id: 'c' };
    const run = fn(vars, {}).then(
      () => null,
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(0);
    onlineManager.setOnline(false);
    abandonQueued({ state: { variables: vars } });
    onlineManager.setOnline(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await run).toMatchObject({ code: 'QUEUE_DROPPED' });
    expect(send).toHaveBeenCalledTimes(1);
  });
});

// Revisión de 15.1: with the tries inside queuedFn, TanStack no longer pauses a change that waits
// for the connection, so «paused» stopped meaning «not on its way»: a toggle waiting offline kept
// its note busy (no undo) and a delete in Compra waited 10 s for it.
describe('a queued change waiting inside its function is parked (revisión 15.1)', () => {
  afterEach(() => {
    setQueueWaiter(undefined);
    onlineManager.setOnline(true);
    vi.useRealTimers();
  });

  it('while it waits between tries or for the connection, and not once it tries again', async () => {
    vi.useFakeTimers();
    markOnline(-RECONNECT_WINDOW_MS);
    let calls = 0;
    const fn = queuedFn((_vars: object) => {
      calls++;
      return calls === 1 ? Promise.reject(new AppError('NETWORK')) : Promise.resolve('ok');
    });
    const vars = {};
    const run = fn(vars, {});
    expect(isParked(vars)).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(isParked(vars)).toBe(true);
    onlineManager.setOnline(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(isParked(vars)).toBe(true);
    onlineManager.setOnline(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(await run).toBe('ok');
    expect(isParked(vars)).toBe(false);
  });

  it('a waiter that fails falls back to a timer instead of dropping the change', async () => {
    vi.useFakeTimers();
    markOnline(-RECONNECT_WINDOW_MS);
    setQueueWaiter(() => {
      throw new Error('module gone');
    });
    let calls = 0;
    const fn = queuedFn((_vars: object) => {
      calls++;
      return calls === 1 ? Promise.reject(new AppError('NETWORK')) : Promise.resolve('ok');
    });
    const run = fn({}, {});
    await vi.advanceTimersByTimeAsync(1000);
    expect(await run).toBe('ok');
  });

  it('a change let go of while it waits for the connection does not go when it comes back', async () => {
    vi.useFakeTimers();
    markOnline(-RECONNECT_WINDOW_MS);
    const send = vi.fn(() => Promise.reject(new AppError('NETWORK')));
    const fn = queuedFn(send);
    const vars = { id: 'd' };
    const run = fn(vars, {}).then(
      () => null,
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(0);
    onlineManager.setOnline(false);
    // The wait between tries ends offline: now it waits for the connection.
    await vi.advanceTimersByTimeAsync(2000);
    abandonQueued({ state: { variables: vars } });
    onlineManager.setOnline(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(await run).toMatchObject({ code: 'QUEUE_DROPPED' });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
