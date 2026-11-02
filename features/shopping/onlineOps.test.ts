import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { afterShoppingQueue, QUEUE_WAIT_MS, resolvedItemId, resolvedKey } from './offline';

vi.mock('./api', () => ({}));

/**
 * Bloque 14.4 (T7): editing, deleting and clearing shared the household's queue, so behind a
 * change that kept failing (a 503 for a while) they waited for ever, «guardando»; and edit and
 * delete used the id the person saw, not the item an add offline was merged into.
 */
describe('Compra online operations', () => {
  afterEach(() => vi.useRealTimers());

  /** A queued add of a household, which settles when `finish` is called (or never). */
  function queuedAdd(client: QueryClient, householdId: string) {
    let finish: () => void = () => undefined;
    void new MutationObserver<void, Error, { householdId: string }>(client, {
      mutationKey: ['shopping', 'add'],
      mutationFn: () => new Promise<void>((resolve) => (finish = resolve)),
    })
      .mutate({ householdId })
      .catch(() => undefined);
    return () => finish();
  }

  it('take the id an add was merged into', () => {
    const client = new QueryClient();
    client.setQueryData(resolvedKey('casa'), { local: 'server' });
    expect(resolvedItemId(client, 'casa', 'local')).toBe('server');
    expect(resolvedItemId(client, 'casa', 'other')).toBe('other');
    expect(resolvedItemId(client, undefined, 'local')).toBe('local');
  });

  it('go after the queued changes of the household, but never wait more than a while', async () => {
    vi.useFakeTimers();
    const client = new QueryClient();
    queuedAdd(client, 'casa');
    let done = false;
    void afterShoppingQueue(client, 'casa').then(() => (done = true));
    await vi.advanceTimersByTimeAsync(QUEUE_WAIT_MS - 100);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(done).toBe(true);
  });

  it('go at once when nothing of that household is queued', async () => {
    const client = new QueryClient();
    queuedAdd(client, 'mama');
    await expect(afterShoppingQueue(client, 'casa')).resolves.toBeUndefined();
  });

  it('go as soon as the queue empties', async () => {
    vi.useFakeTimers();
    const client = new QueryClient();
    const finish = queuedAdd(client, 'casa');
    let done = false;
    void afterShoppingQueue(client, 'casa').then(() => (done = true));
    await vi.advanceTimersByTimeAsync(500);
    finish();
    await vi.advanceTimersByTimeAsync(10);
    expect(done).toBe(true);
  });
});
