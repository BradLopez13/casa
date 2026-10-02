import { describe, expect, it } from 'vitest';
import { AuthFailure, toAuthFailure } from './errors';

describe('toAuthFailure', () => {
  it.each([
    ['invalid_credentials', 'INVALID_CREDENTIALS'],
    ['user_already_exists', 'EMAIL_TAKEN'],
    ['email_exists', 'EMAIL_TAKEN'],
    ['weak_password', 'WEAK_PASSWORD'],
    ['something_else', 'UNKNOWN'],
  ])('maps auth code %s to %s', (code, expected) => {
    expect(toAuthFailure({ code, message: 'x' }).code).toBe(expected);
  });

  it.each(['Network request failed', 'Failed to fetch', 'fetch failed'])(
    'maps network message "%s" to NETWORK',
    (message) => {
      expect(toAuthFailure(new Error(message)).code).toBe('NETWORK');
    },
  );

  it('maps non-objects and empty objects to UNKNOWN', () => {
    expect(toAuthFailure(null).code).toBe('UNKNOWN');
    expect(toAuthFailure('boom').code).toBe('UNKNOWN');
    expect(toAuthFailure({}).code).toBe('UNKNOWN');
  });

  it('returns an existing AuthFailure unchanged', () => {
    const failure = new AuthFailure('EMAIL_TAKEN');
    expect(toAuthFailure(failure)).toBe(failure);
  });
});
