import { describe, expect, it } from 'vitest';
import { AuthFailure, toAuthFailure } from './errors';

describe('toAuthFailure', () => {
  it.each([
    ['invalid_credentials', 'INVALID_CREDENTIALS'],
    ['user_already_exists', 'EMAIL_TAKEN'],
    ['email_exists', 'EMAIL_TAKEN'],
    ['weak_password', 'WEAK_PASSWORD'],
    ['otp_expired', 'INVALID_CODE'],
    ['email_not_confirmed', 'EMAIL_NOT_CONFIRMED'],
    ['over_email_send_rate_limit', 'RATE_LIMITED'],
    ['over_request_rate_limit', 'RATE_LIMITED'],
    ['something_else', 'UNKNOWN'],
  ])('maps auth code %s to %s', (code, expected) => {
    expect(toAuthFailure({ code, message: 'x' }).code).toBe(expected);
  });

  it.each([
    'Network request failed',
    'Failed to fetch',
    'fetch failed',
    'signal timed out',
    'Aborted',
  ])('maps network message "%s" to NETWORK', (message) => {
    expect(toAuthFailure(new Error(message)).code).toBe('NETWORK');
  });

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
