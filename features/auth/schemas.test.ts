import { describe, expect, it } from 'vitest';
import { signInSchema, signUpSchema } from './schemas';

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
