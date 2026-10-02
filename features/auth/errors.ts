export type AuthErrorCode =
  'INVALID_CREDENTIALS' | 'EMAIL_TAKEN' | 'WEAK_PASSWORD' | 'NETWORK' | 'UNKNOWN';

export class AuthFailure extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode) {
    super(code);
    this.name = 'AuthFailure';
    this.code = code;
  }
}

const AUTH_CODES: Readonly<Record<string, AuthErrorCode>> = {
  invalid_credentials: 'INVALID_CREDENTIALS',
  user_already_exists: 'EMAIL_TAKEN',
  email_exists: 'EMAIL_TAKEN',
  weak_password: 'WEAK_PASSWORD',
};

const NETWORK_MESSAGE = /Network request failed|Failed to fetch|fetch failed/i;

/** Maps a supabase-js auth error (or anything thrown) to an AuthFailure. */
export function toAuthFailure(e: unknown): AuthFailure {
  if (e instanceof AuthFailure) return e;
  if (typeof e !== 'object' || e === null) return new AuthFailure('UNKNOWN');

  const code = 'code' in e && typeof e.code === 'string' ? e.code : undefined;
  const message = 'message' in e && typeof e.message === 'string' ? e.message : '';

  const mapped = code === undefined ? undefined : AUTH_CODES[code];
  if (mapped) return new AuthFailure(mapped);
  if (NETWORK_MESSAGE.test(message)) return new AuthFailure('NETWORK');
  return new AuthFailure('UNKNOWN');
}
