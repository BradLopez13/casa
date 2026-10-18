import storage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), setItem: vi.fn() },
}));

const KEY = 'casa-hint-complete';

async function fresh() {
  vi.resetModules();
  return import('./completeHint');
}

describe('completeHint', () => {
  let saved: Map<string, string>;

  beforeEach(() => {
    saved = new Map();
    vi.mocked(storage.getItem).mockReset();
    vi.mocked(storage.setItem).mockReset();
    vi.mocked(storage.getItem).mockImplementation((k: string) =>
      Promise.resolve(saved.get(k) ?? null),
    );
    vi.mocked(storage.setItem).mockImplementation((k: string, v: string) => {
      saved.set(k, v);
      return Promise.resolve();
    });
  });

  it('has not been seen on a new device', async () => {
    const { loadHintSeen } = await fresh();
    expect(await loadHintSeen()).toBe(false);
  });

  it('is remembered on the device once a task is completed', async () => {
    const { loadHintSeen, markHintSeen } = await fresh();
    markHintSeen();
    expect(await loadHintSeen()).toBe(true);
    await vi.waitFor(() => expect(saved.get(KEY)).toBe('1'));
    // A later start of the app reads it back from storage.
    const again = await fresh();
    expect(await again.loadHintSeen()).toBe(true);
  });

  it('stays hidden when storage cannot be read', async () => {
    vi.mocked(storage.getItem).mockRejectedValue(new Error('broken'));
    const { loadHintSeen } = await fresh();
    expect(await loadHintSeen()).toBe(true);
  });

  it('does not throw when storage cannot be written', async () => {
    vi.mocked(storage.setItem).mockRejectedValue(new Error('full'));
    const { loadHintSeen, markHintSeen } = await fresh();
    expect(() => markHintSeen()).not.toThrow();
    expect(await loadHintSeen()).toBe(true);
  });

  it('tells its listeners when it is seen', async () => {
    const { markHintSeen, subscribeHint } = await fresh();
    const listener = vi.fn();
    const stop = subscribeHint(listener);
    markHintSeen();
    expect(listener).toHaveBeenCalledWith(true);
    stop();
  });
});
