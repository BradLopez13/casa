export type SecureKeyValue = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

export type ChunkedStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/**
 * SecureStore limits each value to about 2 KB, and a Supabase session is
 * larger, so values are split into `${key}.0 … ${key}.N-1` with the chunk
 * count in `${key}.n`.
 *
 * The default chunk size assumes mostly-ASCII content (JWTs and JSON), which is
 * what Supabase sessions are; 1800 UTF-16 units is not guaranteed to fit in
 * ~2048 bytes for arbitrary non-ASCII text. Chunks never end in the middle of a
 * surrogate pair, so each one is valid UTF-16 and survives native UTF-8 storage.
 */
export function createChunkedStorage(store: SecureKeyValue, chunkSize = 1800): ChunkedStorage {
  const countKey = (key: string) => `${key}.n`;
  const chunkKey = (key: string, index: number) => `${key}.${index}`;

  async function readCount(key: string): Promise<number> {
    const raw = await store.getItemAsync(countKey(key));
    const count = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isInteger(count) && count > 0 ? count : 0;
  }

  async function deleteChunksFrom(key: string, from: number, to: number) {
    for (let i = from; i < to; i++) {
      await store.deleteItemAsync(chunkKey(key, i));
    }
  }

  return {
    async getItem(key) {
      const count = await readCount(key);
      if (count === 0) return null;
      let value = '';
      for (let i = 0; i < count; i++) {
        const chunk = await store.getItemAsync(chunkKey(key, i));
        if (chunk === null) return null;
        value += chunk;
      }
      return value;
    },

    async setItem(key, value) {
      const previous = await readCount(key);
      const chunks: string[] = [];
      for (let start = 0; start < value.length;) {
        let end = Math.min(start + chunkSize, value.length);
        const last = value.charCodeAt(end - 1);
        if (end < value.length && last >= 0xd800 && last <= 0xdbff && end - 1 > start) end--;
        chunks.push(value.slice(start, end));
        start = end;
      }
      // Not atomic: an interrupted overwrite can leave a mix of old and new
      // chunks. auth-js then fails to parse the session and signs the user out,
      // which is acceptable.
      for (const [i, chunk] of chunks.entries()) {
        await store.setItemAsync(chunkKey(key, i), chunk);
      }
      await store.setItemAsync(countKey(key), String(chunks.length));
      await deleteChunksFrom(key, chunks.length, previous);
    },

    async removeItem(key) {
      const count = await readCount(key);
      await store.deleteItemAsync(countKey(key));
      await deleteChunksFrom(key, 0, count);
    },
  };
}
