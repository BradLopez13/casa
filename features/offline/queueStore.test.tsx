import AsyncStorage from '@react-native-async-storage/async-storage';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  countStoredQueue,
  forgetQueue,
  QUEUE_SCHEMA,
  queueKey,
  queueScope,
  restoreQueue,
  saveQueue,
} from './queueStore';

const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
  },
}));

/** A queued add waiting for the connection, as the shopping list builds it. */
function queueAdd(client: QueryClient, id: string, householdId: string, scope?: { id: string }) {
  void client
    .getMutationCache()
    .build(client, {
      mutationKey: ['shopping', 'add'],
      networkMode: 'online',
      scope: scope ?? queueScope(['shopping', 'add'], { householdId }),
      mutationFn: () => Promise.resolve(),
    })
    .execute({ id, householdId, name: 'Leche' })
    .catch(() => undefined);
}

const pendingIds = (client: QueryClient) =>
  client
    .getMutationCache()
    .findAll({ status: 'pending' })
    .map((m) => (m.state.variables as { id: string }).id);

beforeEach(() => {
  store.clear();
  onlineManager.setOnline(false);
});
afterEach(() => {
  onlineManager.setOnline(true);
});

describe('the queue on the device (bloque 13, P2-3)', () => {
  it('lives under its own key per person, with its schema, apart from the cache', async () => {
    const client = new QueryClient();
    queueAdd(client, 'p1', 'casa');
    await saveQueue(client, 'ana');
    const saved = JSON.parse(store.get(queueKey('ana'))!) as { v: number; mutations: unknown[] };
    expect(queueKey('ana')).toBe('casa-queue-ana');
    expect(saved.v).toBe(QUEUE_SCHEMA);
    expect(saved.mutations).toHaveLength(1);
    expect(store.has('casa-query-cache')).toBe(false);
  });

  it('removes the key when nothing is left', async () => {
    const client = new QueryClient();
    queueAdd(client, 'p1', 'casa');
    await saveQueue(client, 'ana');
    client.getMutationCache().clear();
    await saveQueue(client, 'ana');
    expect(store.has(queueKey('ana'))).toBe(false);
  });

  it('comes back after a restart, whatever the app version or the cache schema', async () => {
    const before = new QueryClient();
    queueAdd(before, 'p1', 'casa');
    await saveQueue(before, 'ana');
    const after = new QueryClient();
    expect(await restoreQueue(after, 'ana')).toBe(1);
    expect(pendingIds(after)).toEqual(['p1']);
  });

  it('is one person’s: another person restores nothing of it', async () => {
    const client = new QueryClient();
    queueAdd(client, 'p1', 'casa');
    await saveQueue(client, 'ana');
    expect(await restoreQueue(new QueryClient(), 'bo')).toBe(0);
    expect(await countStoredQueue('ana')).toBe(1);
    await forgetQueue('ana');
    expect(await countStoredQueue('ana')).toBe(0);
  });

  it('leaves a queue from a newer schema untouched rather than guess', async () => {
    store.set(queueKey('ana'), JSON.stringify({ v: QUEUE_SCHEMA + 1, mutations: [{}] }));
    expect(await restoreQueue(new QueryClient(), 'ana')).toBe(0);
    expect(store.has(queueKey('ana'))).toBe(true);
  });

  it('takes in the changes an older build kept in the cache, one queue per household', async () => {
    const client = new QueryClient();
    // Restored with the cache, in the one queue older builds had.
    queueAdd(client, 'p1', 'casa', { id: 'shopping' });
    queueAdd(client, 'p2', 'mama', { id: 'shopping' });
    expect(await restoreQueue(client, 'ana')).toBe(2);
    const scopes = client
      .getMutationCache()
      .findAll({ status: 'pending' })
      .map((m) => m.options.scope?.id);
    expect(scopes.sort()).toEqual(['shopping:casa', 'shopping:mama']);
  });

  it('does not double a change found both in the cache and in its own key', async () => {
    const client = new QueryClient();
    queueAdd(client, 'p1', 'casa');
    await saveQueue(client, 'ana');
    expect(await restoreQueue(client, 'ana')).toBe(1);
    expect(pendingIds(client)).toEqual(['p1']);
  });
});

describe('the queue on the device keeps every change (review of bloque 13)', () => {
  /** Bought, put back and bought again offline: three changes, not two. */
  function queueBought(client: QueryClient, bought: boolean) {
    void client
      .getMutationCache()
      .build(client, {
        mutationKey: ['shopping', 'bought'],
        networkMode: 'online',
        scope: queueScope(['shopping', 'bought'], { householdId: 'casa' }),
        mutationFn: () => Promise.resolve(),
      })
      .execute({ id: 'p1', householdId: 'casa', bought, userId: 'ana' })
      .catch(() => undefined);
  }
  const boughtValues = (client: QueryClient) =>
    client
      .getMutationCache()
      .findAll({ status: 'pending' })
      .map((m) => (m.state.variables as { bought: boolean }).bought);

  it('restores a repeated change as many times as it was made', async () => {
    const before = new QueryClient();
    for (const bought of [true, false, true]) queueBought(before, bought);
    await saveQueue(before, 'ana');
    const after = new QueryClient();
    expect(await restoreQueue(after, 'ana')).toBe(3);
    expect(boughtValues(after)).toEqual([true, false, true]);
  });

  it('takes an older build’s queue and its own key once, repeats included', async () => {
    const client = new QueryClient();
    for (const bought of [true, false, true]) queueBought(client, bought);
    await saveQueue(client, 'ana');
    // The cache an older build kept holds the same three, in the one old queue.
    const restarted = new QueryClient();
    for (const bought of [true, false, true]) {
      void restarted
        .getMutationCache()
        .build(restarted, {
          mutationKey: ['shopping', 'bought'],
          networkMode: 'online',
          scope: { id: 'shopping' },
          mutationFn: () => Promise.resolve(),
        })
        .execute({ id: 'p1', householdId: 'casa', bought, userId: 'ana' })
        .catch(() => undefined);
    }
    expect(await restoreQueue(restarted, 'ana')).toBe(3);
  });

  it('copies a queue it cannot read aside before anything is saved over it', async () => {
    const unread = JSON.stringify({ v: QUEUE_SCHEMA + 1, mutations: [{}] });
    store.set(queueKey('ana'), unread);
    await restoreQueue(new QueryClient(), 'ana');
    expect(store.get(`${queueKey('ana')}-unread`)).toBe(unread);
  });
});

describe('a damaged queue (bloque 14.4, T3)', () => {
  // A broken entry made `hydrate` throw; the next save then wrote the queue in memory, maybe
  // empty, over the one on the device, and every change in it was lost without a word.
  it('restores the good changes, leaves out the broken one and keeps a copy of it all', async () => {
    const before = new QueryClient();
    queueAdd(before, 'p1', 'casa');
    queueAdd(before, 'p2', 'casa');
    await vi.waitFor(() => expect(pendingIds(before)).toHaveLength(2));
    await saveQueue(before, 'ana');
    const saved = JSON.parse(store.get(queueKey('ana'))!) as { v: number; mutations: unknown[] };
    saved.mutations.splice(1, 0, { state: 'not a state' }, null);
    const damaged = JSON.stringify(saved);
    store.set(queueKey('ana'), damaged);
    const restarted = new QueryClient();
    expect(await restoreQueue(restarted, 'ana')).toBe(2);
    expect(pendingIds(restarted).sort()).toEqual(['p1', 'p2']);
    expect(store.get(`${queueKey('ana')}-unread`)).toBe(damaged);
  });

  // Revisión de 14.4: a read that failed was taken as an empty queue, and the first save wiped it.
  it('fails when the device cannot be read, instead of taking the queue as empty', async () => {
    store.set(queueKey('ana'), JSON.stringify({ v: QUEUE_SCHEMA, mutations: [] }));
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('disk'));
    await expect(restoreQueue(new QueryClient(), 'ana')).rejects.toThrow('disk');
  });

  it('says when entries were left out or the queue could not be read', async () => {
    const damaged = vi.fn();
    store.set(queueKey('ana'), '{"v":1,"mutations":[nul');
    await restoreQueue(new QueryClient(), 'ana', damaged);
    expect(damaged).toHaveBeenCalledTimes(1);
    store.set(queueKey('ana'), JSON.stringify({ v: QUEUE_SCHEMA, mutations: [null] }));
    await restoreQueue(new QueryClient(), 'ana', damaged);
    expect(damaged).toHaveBeenCalledTimes(2);
  });

  it('keeps a copy aside when restoring fails, so the first save cannot lose it', async () => {
    const before = new QueryClient();
    queueAdd(before, 'p1', 'casa');
    await vi.waitFor(() => expect(pendingIds(before)).toHaveLength(1));
    await saveQueue(before, 'ana');
    const stored = store.get(queueKey('ana'))!;
    const restarted = new QueryClient();
    vi.spyOn(restarted.getMutationCache(), 'build').mockImplementation(() => {
      throw new Error('broken');
    });
    await expect(restoreQueue(restarted, 'ana')).rejects.toThrow('broken');
    expect(store.get(`${queueKey('ana')}-unread`)).toBe(stored);
  });
});

describe('queueScope (bloque 13, Aud P3-1)', () => {
  it('gives each household its own queue, per kind', () => {
    expect(queueScope(['shopping', 'bought'], { householdId: 'casa' })).toEqual({
      id: 'shopping:casa',
    });
    expect(queueScope(['tasks', 'toggle'], { householdId: 'mama' })).toEqual({ id: 'tasks:mama' });
  });
});

void AsyncStorage;
