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
