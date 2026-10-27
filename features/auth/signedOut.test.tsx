import AsyncStorage from '@react-native-async-storage/async-storage';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  countStoredQueue,
  queueKey,
  queueScope,
  saveQueue,
  startSavingQueue,
  stopSavingQueue,
} from '@/features/offline/queueStore';
import { t } from '@/i18n';
import { handleSignedOut } from './signedOut';

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
const release = vi.fn(() => Promise.resolve());
vi.mock('@/features/push/registration', () => ({ releasePushLocally: () => release() }));

function withQueuedAdd() {
  const client = new QueryClient();
  void client
    .getMutationCache()
    .build(client, {
      mutationKey: ['shopping', 'add'],
      networkMode: 'online',
      scope: queueScope(['shopping', 'add'], { householdId: 'casa' }),
      mutationFn: () => Promise.resolve(),
    })
    .execute({ id: 'p1', householdId: 'casa', name: 'Leche' })
    .catch(() => undefined);
  client.setQueryData(['tasks', 'casa'], []);
  return client;
}

beforeEach(() => {
  store.clear();
  release.mockClear();
  onlineManager.setOnline(false);
});
afterEach(() => onlineManager.setOnline(true));

describe('handleSignedOut (bloque 13, P2-3)', () => {
  it('signing out on purpose forgets the cache and the queue: the person was warned', async () => {
    const client = withQueuedAdd();
    const notify = vi.fn();
    startSavingQueue('ana');
    await handleSignedOut({ queryClient: client, previous: 'ana', voluntary: true, notify });
    expect(client.getQueryData(['tasks', 'casa'])).toBeUndefined();
    expect(await countStoredQueue('ana')).toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it('an unasked sign-out keeps the person’s queue, says so and lets the push token go', async () => {
    const client = withQueuedAdd();
    const notify = vi.fn();
    startSavingQueue('ana');
    await handleSignedOut({ queryClient: client, previous: 'ana', voluntary: false, notify });
    // Nobody else sees the data…
    expect(client.getQueryData(['tasks', 'casa'])).toBeUndefined();
    // …and the changes wait for this same person to come back.
    expect(store.has(queueKey('ana'))).toBe(true);
    expect(await countStoredQueue('ana')).toBe(1);
    expect(notify).toHaveBeenCalledWith(t('auth.signedOutUnsentOne'));
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('an unasked sign-out before the queue is restored leaves the stored queue alone', async () => {
    // Stored by the last session; this one has not taken it in yet.
    await saveQueue(withQueuedAdd(), 'ana');
    stopSavingQueue();
    const notify = vi.fn();
    await handleSignedOut({
      queryClient: new QueryClient(),
      previous: 'ana',
      voluntary: false,
      notify,
    });
    expect(await countStoredQueue('ana')).toBe(1);
    expect(notify).toHaveBeenCalledWith(t('auth.signedOutUnsentOne'));
  });

  it('an unasked sign-out with nothing queued says nothing', async () => {
    const client = new QueryClient();
    const notify = vi.fn();
    await handleSignedOut({ queryClient: client, previous: 'ana', voluntary: false, notify });
    expect(notify).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledTimes(1);
  });
});

void AsyncStorage;
