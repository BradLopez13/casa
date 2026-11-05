import { describe, expect, it } from 'vitest';
import { AuthFailure } from '../errors';
import { toSocialFailure } from './failure';

describe('toSocialFailure', () => {
  it.each(['SIGN_IN_CANCELLED', 'ERR_REQUEST_CANCELED', 'ERR_CANCELED'])('maps %s', (code) => {
    expect(toSocialFailure({ code }).code).toBe('OAUTH_CANCELLED');
  });
  it('passes the rest through toAuthFailure', () => {
    expect(toSocialFailure({ message: 'Network request failed' }).code).toBe('NETWORK');
    expect(toSocialFailure({ code: 'weak_password' }).code).toBe('WEAK_PASSWORD');
    expect(toSocialFailure(new Error('x')).code).toBe('UNKNOWN');
  });
  it('keeps an AuthFailure as is', () => {
    const f = new AuthFailure('RATE_LIMITED');
    expect(toSocialFailure(f)).toBe(f);
  });
});

// Bloque 15.4: clashing with an account that already exists, said in words.
describe('clashing accounts (bloque 15.4)', () => {
  it('an email already taken by a password account', () => {
    expect(toSocialFailure({ code: 'email_exists' }).code).toBe('SOCIAL_EMAIL_TAKEN');
    expect(toSocialFailure({ code: 'user_already_exists' }).code).toBe('SOCIAL_EMAIL_TAKEN');
  });
  it('a Google or Apple identity already linked to someone else', () => {
    expect(toSocialFailure({ code: 'identity_already_exists' }).code).toBe('IDENTITY_TAKEN');
  });
  it('a provider Supabase has not got switched on', () => {
    expect(toSocialFailure({ code: 'provider_disabled' }).code).toBe('PROVIDER_OFF');
  });
});
