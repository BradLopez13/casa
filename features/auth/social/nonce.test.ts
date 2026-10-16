import { describe, expect, it } from 'vitest';
import { appleFullName, callbackCancelled, callbackCode, callbackOutcome } from './nonce';

describe('appleFullName', () => {
  it('joins given and family name', () => {
    expect(appleFullName({ givenName: 'Ana', familyName: 'Ruiz' })).toBe('Ana Ruiz');
  });
  it('keeps just the part that exists', () => {
    expect(appleFullName({ givenName: 'Ana', familyName: null })).toBe('Ana');
  });
  it('is null without a name', () => {
    expect(appleFullName(null)).toBeNull();
    expect(appleFullName({})).toBeNull();
  });
});

describe('callbackCode', () => {
  it('reads the code', () => {
    expect(callbackCode({ code: 'abc' })).toBe('abc');
    expect(callbackCode({ code: ['abc'] })).toBe('abc');
  });
  it('is null without a code', () => {
    expect(callbackCode({})).toBeNull();
    expect(callbackCode({ error: 'access_denied' })).toBeNull();
  });
});

describe('callbackOutcome', () => {
  it('exchanges when there is a code', () => {
    expect(callbackOutcome({ code: 'abc' })).toEqual({ kind: 'exchange', code: 'abc' });
  });
  it('is silent on a cancellation', () => {
    expect(callbackOutcome({ error: 'access_denied' })).toEqual({ kind: 'cancelled' });
  });
  it('is an error with no code and no cancellation', () => {
    expect(callbackOutcome({})).toEqual({ kind: 'error' });
    expect(callbackOutcome({ error: 'server_error' })).toEqual({ kind: 'error' });
  });
});

describe('callbackCancelled', () => {
  it('flags a denied or cancelled callback', () => {
    expect(callbackCancelled({ error: 'access_denied' })).toBe(true);
    expect(callbackCancelled({ error: 'user_cancelled_authorize' })).toBe(true);
  });
  it('is false otherwise', () => {
    expect(callbackCancelled({})).toBe(false);
    expect(callbackCancelled({ error: 'server_error' })).toBe(false);
    expect(callbackCancelled({ code: 'abc' })).toBe(false);
  });
});
