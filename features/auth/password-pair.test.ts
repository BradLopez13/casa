import { describe, expect, it } from 'vitest';
import { nextPairState, pairErrors, pairMatches, type PairState } from './password-pair';

const fresh: PairState = { passwordTouched: false, confirmTouched: false, submitted: false };

describe('pairErrors', () => {
  it('shows nothing before the first blur', () => {
    expect(pairErrors(fresh, { password: 'abc', confirm: 'xyz' })).toEqual({});
  });

  it('flags a short password after blurring it', () => {
    const s = nextPairState(fresh, 'blurPassword');
    expect(pairErrors(s, { password: 'abcde', confirm: '' })).toEqual({
      password: 'passwordTooShort',
    });
  });

  it('flags a mismatch after blurring the confirmation', () => {
    const s = nextPairState(fresh, 'blurConfirm');
    expect(pairErrors(s, { password: 'abcdefgh', confirm: 'abcdefgx' })).toEqual({
      confirm: 'passwordMismatch',
    });
  });

  it('clears the error once the values match', () => {
    const s = nextPairState(fresh, 'blurConfirm');
    expect(pairErrors(s, { password: 'abcdefgh', confirm: 'abcdefgx' })).toEqual({
      confirm: 'passwordMismatch',
    });
    expect(pairErrors(s, { password: 'abcdefgh', confirm: 'abcdefgh' })).toEqual({});
  });

  it('re-evaluates when the first password is corrected after a mismatch', () => {
    const s = nextPairState(fresh, 'blurConfirm');
    expect(pairErrors(s, { password: 'abcdefgh', confirm: 'abcdefgx' })).toEqual({
      confirm: 'passwordMismatch',
    });
    expect(pairErrors(s, { password: 'abcdefgx', confirm: 'abcdefgx' })).toEqual({});
    expect(pairErrors(s, { password: 'abcdefgy', confirm: 'abcdefgx' })).toEqual({
      confirm: 'passwordMismatch',
    });
  });

  it('flags both fields on submit with empty values', () => {
    const s = nextPairState(fresh, 'submit');
    expect(pairErrors(s, { password: '', confirm: '' })).toEqual({
      password: 'passwordTooShort',
      confirm: 'passwordConfirmRequired',
    });
  });
});

describe('pairMatches', () => {
  it('requires 8+ characters and equality', () => {
    expect(pairMatches({ password: 'abcdefgh', confirm: 'abcdefgh' })).toBe(true);
    expect(pairMatches({ password: 'abc', confirm: 'abc' })).toBe(false);
    expect(pairMatches({ password: 'abcdefgh', confirm: 'abcdefgx' })).toBe(false);
  });
});
