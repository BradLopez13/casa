import { describe, expect, it } from 'vitest';
import { appleFullName, callbackCode } from './nonce';

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
