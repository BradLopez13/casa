import { describe, expect, it } from 'vitest';
import { createChunkedStorage, type SecureKeyValue } from './chunked-storage';

function memoryStore() {
  const map = new Map<string, string>();
  const store: SecureKeyValue = {
    getItemAsync: (key) => Promise.resolve(map.get(key) ?? null),
    setItemAsync: (key, value) => {
      map.set(key, value);
      return Promise.resolve();
    },
    deleteItemAsync: (key) => {
      map.delete(key);
      return Promise.resolve();
    },
  };
  return { map, store };
}

describe('createChunkedStorage', () => {
  it('round-trips a 5000-char value in 3 chunks of 1800', async () => {
    const { map, store } = memoryStore();
    const storage = createChunkedStorage(store);
    const value = 'x'.repeat(5000);
    await storage.setItem('session', value);
    expect(await storage.getItem('session')).toBe(value);
    expect(map.get('session.n')).toBe('3');
    expect(map.get('session.0')).toHaveLength(1800);
    expect(map.get('session.2')).toHaveLength(1400);
  });

  it('overwriting with a shorter value deletes stale chunks', async () => {
    const { map, store } = memoryStore();
    const storage = createChunkedStorage(store);
    await storage.setItem('session', 'x'.repeat(5000));
    await storage.setItem('session', 'short-value');
    expect(await storage.getItem('session')).toBe('short-value');
    expect(map.has('session.1')).toBe(false);
    expect(map.has('session.2')).toBe(false);
  });

  it('removeItem deletes every chunk', async () => {
    const { map, store } = memoryStore();
    const storage = createChunkedStorage(store);
    await storage.setItem('session', 'x'.repeat(5000));
    await storage.removeItem('session');
    expect(map.size).toBe(0);
    expect(await storage.getItem('session')).toBeNull();
  });

  it('returns null for a missing key', async () => {
    const { store } = memoryStore();
    expect(await createChunkedStorage(store).getItem('nope')).toBeNull();
  });

  it('returns null when a chunk is missing', async () => {
    const { map, store } = memoryStore();
    const storage = createChunkedStorage(store);
    await storage.setItem('session', 'x'.repeat(5000));
    map.delete('session.1');
    expect(await storage.getItem('session')).toBeNull();
  });

  it('never splits a surrogate pair across chunks', async () => {
    const { map, store } = memoryStore();
    const storage = createChunkedStorage(store);
    const value = 'a'.repeat(1799) + '😀' + 'b'.repeat(10);
    await storage.setItem('session', value);
    expect(await storage.getItem('session')).toBe(value);
    const count = Number(map.get('session.n'));
    for (let i = 0; i < count; i++) {
      const chunk = map.get(`session.${i}`) ?? '';
      const last = chunk.charCodeAt(chunk.length - 1);
      expect(last >= 0xd800 && last <= 0xdbff).toBe(false);
    }
  });
});
