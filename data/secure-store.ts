import * as SecureStore from 'expo-secure-store';
import type { SecureKeyValue } from './supabase/chunked-storage';

/** The device keychain/keystore. The web build resolves `secure-store.web.ts` instead. */
export const secureStore: SecureKeyValue = SecureStore;
