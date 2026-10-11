import type { SecureKeyValue } from './supabase/chunked-storage';

/**
 * expo-secure-store has no web implementation, so the browser keeps these values in
 * localStorage. The static render runs in Node, without `window`: there nothing is stored and
 * every read is empty (signed out), and the browser takes over once it hydrates. A browser that
 * blocks storage (private mode, blocked site data) throws on access: treated as empty too.
 */
function withStorage<T>(fallback: T, use: (storage: Storage) => T): Promise<T> {
  try {
    return Promise.resolve(typeof window === 'undefined' ? fallback : use(window.localStorage));
  } catch {
    return Promise.resolve(fallback);
  }
}

export const secureStore: SecureKeyValue = {
  getItemAsync: (key) => withStorage(null, (storage) => storage.getItem(key)),
  setItemAsync: (key, value) => withStorage(undefined, (storage) => storage.setItem(key, value)),
  deleteItemAsync: (key) => withStorage(undefined, (storage) => storage.removeItem(key)),
};
