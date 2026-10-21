import { isNetworkFailure } from '@/data/supabase/errors';

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_TAKEN'
  | 'WEAK_PASSWORD'
  | 'INVALID_CODE'
  | 'EMAIL_NOT_CONFIRMED'
  | 'RATE_LIMITED'
  | 'OAUTH_CANCELLED'
  | 'NETWORK'
  | 'UNKNOWN';

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
  otp_expired: 'INVALID_CODE',
  email_not_confirmed: 'EMAIL_NOT_CONFIRMED',
  over_email_send_rate_limit: 'RATE_LIMITED',
  over_request_rate_limit: 'RATE_LIMITED',
};

/** Maps a supabase-js auth error (or anything thrown) to an AuthFailure. */
export function toAuthFailure(e: unknown): AuthFailure {
  if (e instanceof AuthFailure) return e;
  if (typeof e !== 'object' || e === null) return new AuthFailure('UNKNOWN');

  const code = 'code' in e && typeof e.code === 'string' ? e.code : undefined;

  const mapped = code === undefined ? undefined : AUTH_CODES[code];
  if (mapped) return new AuthFailure(mapped);
  if (isNetworkFailure(e)) return new AuthFailure('NETWORK');
  return new AuthFailure('UNKNOWN');
}
