import { describe, expect, it } from 'vitest';
import {
  codeSchema,
  emailSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from './schemas';

const valid = { displayName: 'Ana', email: 'ana@example.com', password: '12345678' };

describe('signUpSchema', () => {
  it('accepts valid input', () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const r = signUpSchema.safeParse({ ...valid, email: 'not-an-email' });
    expect(r.success).toBe(false);
  });

  it('rejects a 7 character password', () => {
    expect(signUpSchema.safeParse({ ...valid, password: '1234567' }).success).toBe(false);
  });

  it('accepts an 8 character password', () => {
    expect(signUpSchema.safeParse({ ...valid, password: '12345678' }).success).toBe(true);
  });

  it('trims the display name', () => {
    const r = signUpSchema.parse({ ...valid, displayName: '  Ana  ' });
    expect(r.displayName).toBe('Ana');
  });

  it('rejects an empty or blank name and one over 40 characters', () => {
    expect(signUpSchema.safeParse({ ...valid, displayName: '   ' }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, displayName: 'a'.repeat(41) }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, displayName: 'a'.repeat(40) }).success).toBe(true);
  });
});

describe('signInSchema', () => {
  it('accepts valid input', () => {
    expect(signInSchema.safeParse({ email: 'ana@example.com', password: 'x' }).success).toBe(true);
  });

  it('rejects an invalid email and an empty password', () => {
    expect(signInSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
    expect(signInSchema.safeParse({ email: 'ana@example.com', password: '' }).success).toBe(false);
  });
});

describe('codeSchema', () => {
  it('strips spaces and dashes', () => {
    expect(codeSchema.parse('123 456')).toBe('123456');
    expect(codeSchema.parse('123-456')).toBe('123456');
  });

  it('rejects wrong length and non-digits', () => {
    expect(codeSchema.safeParse('12345').success).toBe(false);
    expect(codeSchema.safeParse('1234567').success).toBe(false);
    expect(codeSchema.safeParse('abcdef').success).toBe(false);
  });
});

describe('emailSchema', () => {
  it('trims and validates', () => {
    expect(emailSchema.parse(' ana@example.com ')).toBe('ana@example.com');
    expect(emailSchema.safeParse('nope').success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('accepts a code and an 8 character password', () => {
    expect(resetPasswordSchema.safeParse({ code: '123456', password: '12345678' }).success).toBe(
      true,
    );
  });

  it('rejects a 7 character password on password', () => {
    const r = resetPasswordSchema.safeParse({ code: '123456', password: '1234567' });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.issues[0]?.path[0]).toBe('password');
  });
});
