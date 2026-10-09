import { describe, expect, it } from 'vitest';
import { shoppingNameSchema, shoppingQuantitySchema } from './schemas';

describe('shoppingNameSchema', () => {
  it('trims', () => {
    const r = shoppingNameSchema.safeParse('  Leche  ');
    expect(r.success && r.data).toBe('Leche');
  });

  it('trims with the pinned whitespace class, not String.trim', () => {
    expect(shoppingNameSchema.safeParse(' Leche ').data).toBe('Leche');
    // U+FEFF is trimmed by String.trim but is not in the pinned class.
    expect(shoppingNameSchema.safeParse('﻿Leche').data).toBe('﻿Leche');
  });

  it('rejects blank names', () => {
    expect(shoppingNameSchema.safeParse('    ').success).toBe(false);
  });

  it('accepts 60 and rejects 61 code points', () => {
    expect(shoppingNameSchema.safeParse('a'.repeat(60)).success).toBe(true);
    expect(shoppingNameSchema.safeParse('a'.repeat(61)).success).toBe(false);
    expect(shoppingNameSchema.safeParse('😀'.repeat(60)).success).toBe(true);
    expect(shoppingNameSchema.safeParse('😀'.repeat(61)).success).toBe(false);
  });
});

describe('shoppingQuantitySchema', () => {
  it('trims', () => expect(shoppingQuantitySchema.parse(' 2 kg ')).toBe('2 kg'));

  it('turns blank into null', () => {
    expect(shoppingQuantitySchema.parse('   ')).toBeNull();
    expect(shoppingQuantitySchema.parse(' \t')).toBeNull();
    expect(shoppingQuantitySchema.parse('')).toBeNull();
  });

  it('accepts 20 and rejects 21 code points', () => {
    expect(shoppingQuantitySchema.safeParse('a'.repeat(20)).success).toBe(true);
    expect(shoppingQuantitySchema.safeParse('a'.repeat(21)).success).toBe(false);
    expect(shoppingQuantitySchema.safeParse('😀'.repeat(20)).success).toBe(true);
    expect(shoppingQuantitySchema.safeParse('😀'.repeat(21)).success).toBe(false);
  });
});
