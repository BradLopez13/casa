import { AuthFailure, toAuthFailure } from '../errors';

// Literals (not the native statusCodes) so this stays importable in Node and Expo Go.
const CANCELLED = new Set(['SIGN_IN_CANCELLED', 'ERR_REQUEST_CANCELED', 'ERR_CANCELED']);

// What Supabase answers when a social sign-in clashes with an account that exists (bloque 15.4):
// the email of a password account whose email is not confirmed (a confirmed one is linked and
// signs in), an identity already linked to someone else, a provider not switched on.
const CLASH: Readonly<Record<string, 'SOCIAL_EMAIL_TAKEN' | 'IDENTITY_TAKEN' | 'PROVIDER_OFF'>> = {
  email_exists: 'SOCIAL_EMAIL_TAKEN',
  user_already_exists: 'SOCIAL_EMAIL_TAKEN',
  identity_already_exists: 'IDENTITY_TAKEN',
  provider_disabled: 'PROVIDER_OFF',
};

/** Maps a Google/Apple/supabase sign-in error to an AuthFailure; user cancels become OAUTH_CANCELLED. */
export function toSocialFailure(e: unknown): AuthFailure {
  if (typeof e === 'object' && e !== null && 'code' in e && typeof e.code === 'string') {
    if (CANCELLED.has(e.code)) return new AuthFailure('OAUTH_CANCELLED');
    const clash = CLASH[e.code];
    if (clash) return new AuthFailure(clash);
  }
  return toAuthFailure(e);
}
