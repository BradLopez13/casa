import storage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), setItem: vi.fn() },
}));

async function fresh() {
  vi.resetModules();
  return import('./hints');
}

describe('first-use hints', () => {
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
    expect(await loadHintSeen('complete')).toBe(false);
    expect(await loadHintSeen('quickAdd')).toBe(false);
  });

  it('is remembered on the device once used, each hint on its own', async () => {
    const { loadHintSeen, markHintSeen } = await fresh();
    markHintSeen('swipe');
    expect(await loadHintSeen('swipe')).toBe(true);
    expect(await loadHintSeen('quantity')).toBe(false);
    await vi.waitFor(() => expect(saved.get('casa-hint-swipe')).toBe('1'));
    // A later start of the app reads it back from storage.
    const again = await fresh();
    expect(await again.loadHintSeen('swipe')).toBe(true);
    expect(await again.loadHintSeen('quantity')).toBe(false);
  });

  it('keeps the key the box hint has always used, so a phone that saw it stays quiet', async () => {
    saved.set('casa-hint-complete', '1');
    const { loadHintSeen } = await fresh();
    expect(await loadHintSeen('complete')).toBe(true);
  });

  it('stays hidden when storage cannot be read', async () => {
    vi.mocked(storage.getItem).mockRejectedValue(new Error('broken'));
    const { loadHintSeen } = await fresh();
    expect(await loadHintSeen('refresh')).toBe(true);
  });

  it('does not throw when storage cannot be written', async () => {
    vi.mocked(storage.setItem).mockRejectedValue(new Error('full'));
    const { loadHintSeen, markHintSeen } = await fresh();
    expect(() => markHintSeen('complete')).not.toThrow();
    expect(await loadHintSeen('complete')).toBe(true);
  });

  it('a use while storage is still being read wins over what it says', async () => {
    let resolve: (v: string | null) => void = () => undefined;
    vi.mocked(storage.getItem).mockReturnValue(new Promise((r) => (resolve = r)));
    const { loadHintSeen, markHintSeen } = await fresh();
    const reading = loadHintSeen('quickAdd');
    markHintSeen('quickAdd');
    resolve(null);
    expect(await reading).toBe(true);
  });

  it('tells the listeners of that hint only', async () => {
    const { markHintSeen, subscribeHint } = await fresh();
    const swipe = vi.fn();
    const quantity = vi.fn();
    const stopSwipe = subscribeHint('swipe', swipe);
    const stopQuantity = subscribeHint('quantity', quantity);
    markHintSeen('swipe');
    expect(swipe).toHaveBeenCalledWith(true);
    expect(quantity).not.toHaveBeenCalled();
    stopSwipe();
    stopQuantity();
  });
});
