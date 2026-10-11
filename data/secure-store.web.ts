import type { SecureKeyValue } from './supabase/chunked-storage';

/**
 * expo-secure-store has no web implementation, so the browser keeps these values in
 * localStorage. The static render runs in Node, without `window`: there nothing is stored and
 * every read is empty (signed out), and the browser takes over once it hydrates.
 */
const storage = (): Storage | null => (typeof window === 'undefined' ? null : window.localStorage);

export const secureStore: SecureKeyValue = {
  getItemAsync: (key) => Promise.resolve(storage()?.getItem(key) ?? null),
  setItemAsync: (key, value) => Promise.resolve(storage()?.setItem(key, value)),
  deleteItemAsync: (key) => Promise.resolve(storage()?.removeItem(key)),
};
