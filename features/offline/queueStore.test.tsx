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

describe('queueScope (bloque 13, Aud P3-1)', () => {
  it('gives each household its own queue, per kind', () => {
    expect(queueScope(['shopping', 'bought'], { householdId: 'casa' })).toEqual({
      id: 'shopping:casa',
    });
    expect(queueScope(['tasks', 'toggle'], { householdId: 'mama' })).toEqual({ id: 'tasks:mama' });
  });
});

void AsyncStorage;
