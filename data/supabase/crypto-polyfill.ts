import { Platform } from 'react-native';
import { getRandomValues } from 'expo-crypto';

type Target = { crypto?: { getRandomValues?: unknown } };

/** Adds `crypto.getRandomValues` to `target` only when it is missing. Returns whether it installed. */
export function installRandomValues(target: Target, impl: (a: never) => unknown): boolean {
  if (typeof target.crypto?.getRandomValues === 'function') return false;
  target.crypto = Object.assign(target.crypto ?? {}, { getRandomValues: impl });
  return true;
}

// Hermes has no WebCrypto: without this, auth-js builds the PKCE verifier from Math.random.
// `crypto.subtle` stays absent on purpose, so the challenge method remains `plain`.
if (Platform.OS !== 'web') installRandomValues(globalThis, getRandomValues);
