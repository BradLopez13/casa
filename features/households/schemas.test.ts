import { describe, expect, it } from 'vitest';
import { householdNameSchema } from './schemas';

describe('householdNameSchema', () => {
  it('trims household names', () => {
    expect(householdNameSchema.parse('  Casa ')).toBe('Casa');
  });

  it('rejects blank and 61-char names', () => {
    expect(householdNameSchema.safeParse('   ').success).toBe(false);
    expect(householdNameSchema.safeParse('a'.repeat(61)).success).toBe(false);
    expect(householdNameSchema.safeParse('a'.repeat(60)).success).toBe(true);
  });
});
