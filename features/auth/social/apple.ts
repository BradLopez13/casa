import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/data/supabase/client';
import { AuthFailure } from '../errors';
import { toSocialFailure } from './failure';
import { appleFullName } from './nonce';

function randomNonce(): string {
  return Array.from(Crypto.getRandomBytes(32), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Native Sign in with Apple (iOS), then exchanges the identity token for a Supabase session. */
export async function signInWithApple(): Promise<void> {
  try {
    const nonce = randomNonce();
    const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashed,
    });
    if (!credential.identityToken) throw new AuthFailure('UNKNOWN');
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce,
    });
    if (error) throw error;
    // Apple only sends the name the first time; keep it, but never block the sign-in on it.
    const name = appleFullName(credential.fullName);
    if (name) {
      try {
        await supabase.rpc('set_provider_display_name', { p_name: name });
      } catch {
        // Best effort.
      }
    }
  } catch (e) {
    throw toSocialFailure(e);
  }
}
