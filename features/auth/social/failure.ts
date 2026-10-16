import { AuthFailure, toAuthFailure } from '../errors';

// Literals (not the native statusCodes) so this stays importable in Node and Expo Go.
const CANCELLED = new Set(['SIGN_IN_CANCELLED', 'ERR_REQUEST_CANCELED', 'ERR_CANCELED']);

/** Maps a Google/Apple/supabase sign-in error to an AuthFailure; user cancels become OAUTH_CANCELLED. */
export function toSocialFailure(e: unknown): AuthFailure {
  if (typeof e === 'object' && e !== null && 'code' in e && typeof e.code === 'string') {
    if (CANCELLED.has(e.code)) return new AuthFailure('OAUTH_CANCELLED');
  }
  return toAuthFailure(e);
}
