import { describe, expect, it } from 'vitest';
import { authErrorKey, fieldErrors, visibleAuthError } from './form-errors';
import { resetPasswordSchema, signInSchema, signUpSchema } from './schemas';

describe('fieldErrors', () => {
  it('maps sign-up issues to one i18n key per field', () => {
    const r = signUpSchema.safeParse({ displayName: ' ', email: 'x', password: '123' });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(fieldErrors(r.error, { form: 'signUp' })).toEqual({
      displayName: 'auth.errors.nameRequired',
      email: 'auth.errors.emailInvalid',
      password: 'auth.errors.passwordTooShort',
    });
  });

  it('maps a too long name', () => {
    const r = signUpSchema.safeParse({
      displayName: 'a'.repeat(41),
      email: 'a@b.co',
      password: '12345678',
    });
    if (r.success) throw new Error('expected failure');
    expect(fieldErrors(r.error, { form: 'signUp' })).toEqual({
      displayName: 'auth.errors.nameTooLong',
    });
  });

  it('reports an empty sign-in password as required', () => {
    const r = signInSchema.safeParse({ email: 'a@b.co', password: '' });
    if (r.success) throw new Error('expected failure');
    expect(fieldErrors(r.error, { form: 'signIn' })).toEqual({
      password: 'auth.errors.passwordRequired',
    });
  });

  it('maps a bad code', () => {
    const r = resetPasswordSchema.safeParse({ code: '12', password: '12345678' });
    if (r.success) throw new Error('expected failure');
    expect(fieldErrors(r.error, { form: 'reset' })).toEqual({ code: 'auth.errors.codeInvalid' });
  });

  it('maps a short password on reset', () => {
    const r = resetPasswordSchema.safeParse({ code: '123456', password: '123' });
    if (r.success) throw new Error('expected failure');
    expect(fieldErrors(r.error, { form: 'reset' })).toEqual({
      password: 'auth.errors.passwordTooShort',
    });
  });
});

describe('fieldErrors for the confirmation', () => {
  it('maps a mismatch', () => {
    const r = resetPasswordSchema.safeParse({
      code: '123456',
      password: '12345678',
      passwordConfirm: '1234567x',
    });
    if (r.success) throw new Error('expected failure');
    expect(fieldErrors(r.error, { form: 'reset' })).toEqual({
      passwordConfirm: 'auth.errors.passwordMismatch',
    });
  });

  it('maps an empty repetition', () => {
    const r = signUpSchema.safeParse({
      displayName: 'Ana',
      email: 'a@b.co',
      password: '12345678',
      passwordConfirm: '',
    });
    if (r.success) throw new Error('expected failure');
    expect(fieldErrors(r.error, { form: 'signUp' })).toEqual({
      passwordConfirm: 'auth.errors.passwordConfirmRequired',
    });
  });
});

describe('authErrorKey', () => {
  it('namespaces the code', () => {
    expect(authErrorKey('EMAIL_TAKEN')).toBe('auth.errors.EMAIL_TAKEN');
  });
});

describe('visibleAuthError', () => {
  it('hides a cancelled social sign-in', () => {
    expect(visibleAuthError('OAUTH_CANCELLED')).toBeNull();
  });

  it('shows every other code', () => {
    expect(visibleAuthError('INVALID_CODE')).toBe('auth.errors.INVALID_CODE');
    expect(visibleAuthError('UNKNOWN')).toBe('auth.errors.UNKNOWN');
  });
});
