import { MutationObserver, onlineManager, QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { markOnline, QUEUED_RETRY, queuedFn, RECONNECT_WINDOW_MS } from '@/data/query/retry';
import { AppError } from '@/data/supabase/errors';
import {
  afterShoppingQueue,
  dropQueuedQuantities,
  QUEUE_WAIT_MS,
  quantityKey,
  resolvedItemId,
  resolvedKey,
} from './offline';

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

  // Revisión de 15.1: an add whose try failed and then went offline waits inside queuedFn, not
  // paused by TanStack: a delete made then waited the full 10 s for it.
  it('do not wait for a change waiting inside its function for the connection', async () => {
    vi.useFakeTimers();
    markOnline(-RECONNECT_WINDOW_MS);
    try {
      const client = new QueryClient();
      void new MutationObserver<void, AppError, { householdId: string }>(client, {
        mutationKey: ['shopping', 'add'],
        networkMode: 'online',
        retry: QUEUED_RETRY,
        mutationFn: queuedFn(() => Promise.reject(new AppError('NETWORK'))),
      })
        .mutate({ householdId: 'casa' })
        .catch(() => undefined);
      await vi.advanceTimersByTimeAsync(0);
      onlineManager.setOnline(false);
      let done = false;
      void afterShoppingQueue(client, 'casa').then(() => (done = true));
      await vi.advanceTimersByTimeAsync(1500);
      expect(done).toBe(true);
    } finally {
      onlineManager.setOnline(true);
    }
  });

  // Revisión de 14.4: offline, a delete waited 10 s for adds that could not go, then failed.
  it('do not wait for changes paused offline', async () => {
    onlineManager.setOnline(false);
    try {
      const client = new QueryClient();
      void new MutationObserver<void, Error, { householdId: string }>(client, {
        mutationKey: ['shopping', 'add'],
        networkMode: 'online',
        mutationFn: () => Promise.resolve(),
      })
        .mutate({ householdId: 'casa' })
        .catch(() => undefined);
      await expect(afterShoppingQueue(client, 'casa')).resolves.toBeUndefined();
    } finally {
      onlineManager.setOnline(true);
    }
  });

  // Revisión de 14.4: a quantity stuck in the queue arrived after an edit made in the sheet and
  // put the old quantity back.
  it('an edit saved lets go the quantities still queued for that product', () => {
    const client = new QueryClient();
    client.setQueryData(resolvedKey('casa'), { local: 'server' });
    const queued = (id: string) =>
      void new MutationObserver<void, Error, { id: string; householdId: string }>(client, {
        mutationKey: quantityKey,
        mutationFn: () => new Promise<void>(() => undefined),
      })
        .mutate({ id, householdId: 'casa' })
        .catch(() => undefined);
    queued('local');
    queued('other');
    dropQueuedQuantities(client, 'casa', 'server');
    const left = client
      .getMutationCache()
      .findAll({ status: 'pending' })
      .map((m) => (m.state.variables as { id: string }).id);
    expect(left).toEqual(['other']);
  });
});
