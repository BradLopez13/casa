import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/data/supabase/errors';
import {
  markOnline,
  NETWORK_RETRY_LIMIT,
  NETWORK_RETRY_MAX_MS,
  queuedFn,
  RECONNECT_RETRY_MS,
  RECONNECT_WINDOW_MS,
  retryDelayOnNetwork,
  retryOnNetwork,
  retryQueuedNow,
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
