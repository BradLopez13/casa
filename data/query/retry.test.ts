import { describe, expect, it } from 'vitest';
import { AppError } from '@/data/supabase/errors';
import {
  markOnline,
  NETWORK_RETRY_LIMIT,
  NETWORK_RETRY_MAX_MS,
  RECONNECT_RETRY_MS,
  RECONNECT_WINDOW_MS,
  retryDelayOnNetwork,
  retryOnNetwork,
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
