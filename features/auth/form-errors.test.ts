import { describe, expect, it } from 'vitest';
import { authErrorKey, fieldErrors } from './form-errors';
import { signInSchema, signUpSchema } from './schemas';

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
});

describe('authErrorKey', () => {
  it('namespaces the code', () => {
    expect(authErrorKey('EMAIL_TAKEN')).toBe('auth.errors.EMAIL_TAKEN');
  });
});
