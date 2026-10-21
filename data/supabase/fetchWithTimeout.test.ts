import { afterEach, describe, expect, it, vi } from 'vitest';
import { REQUEST_TIMEOUT_MS, withTimeout } from './fetchWithTimeout';

afterEach(() => {
  vi.useRealTimers();
});

describe('withTimeout', () => {
  it('cuts a request that gets no answer in time, as a TimeoutError', async () => {
    vi.useFakeTimers();
    const hang = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    const request = withTimeout(hang as typeof fetch)('https://x.test');
    const failed = expect(request).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    await failed;
  });

  it('lets an answer in time through', async () => {
    const ok = new Response('ok');
    const base = vi.fn(() => Promise.resolve(ok));
    await expect(withTimeout(base as typeof fetch)('https://x.test')).resolves.toBe(ok);
  });

  it("keeps the caller's own signal", async () => {
    let seen: AbortSignal | undefined;
    const hang = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          seen = init?.signal ?? undefined;
          init?.signal?.addEventListener('abort', () => reject(new Error('stopped')));
        }),
    );
    const own = new AbortController();
    const request = withTimeout(hang as typeof fetch)('https://x.test', { signal: own.signal });
    own.abort();
    await expect(request).rejects.toThrow('stopped');
    expect(seen?.aborted).toBe(true);
  });
});
