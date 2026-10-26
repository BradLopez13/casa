import { describe, expect, it } from 'vitest';
import { AppError } from '@/data/supabase/errors';
import { NETWORK_RETRY_MAX_MS, retryDelayOnNetwork, retryOnNetwork } from './retry';

describe('retryOnNetwork', () => {
  // Bloque 11 (T1): a connection that hangs without failing (a captive portal, a weak signal) used
  // to spend ten retries in about five minutes and drop the change. A change that never reached
  // the server is never given up on.
  it('never gives up on a change that did not reach the server', () => {
    expect(retryOnNetwork(0, new AppError('NETWORK'))).toBe(true);
    expect(retryOnNetwork(10, new AppError('NETWORK'))).toBe(true);
    expect(retryOnNetwork(1000, new AppError('NETWORK'))).toBe(true);
  });

  it('takes any answer from the server as final', () => {
    expect(retryOnNetwork(0, new AppError('INVALID_ITEM_NAME'))).toBe(false);
    expect(retryOnNetwork(0, new AppError('UNKNOWN'))).toBe(false);
  });
});

describe('retryDelayOnNetwork', () => {
  it('waits longer each time, up to a minute', () => {
    expect(retryDelayOnNetwork(0)).toBe(1000);
    expect(retryDelayOnNetwork(1)).toBe(2000);
    expect(retryDelayOnNetwork(3)).toBe(8000);
    expect(retryDelayOnNetwork(20)).toBe(NETWORK_RETRY_MAX_MS);
    expect(NETWORK_RETRY_MAX_MS).toBe(60_000);
  });
});
