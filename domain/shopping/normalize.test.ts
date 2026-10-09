import { describe, expect, it } from 'vitest';
import cases from './normalize-cases.json';
import { normalizeItemName } from './normalize';

describe('normalizeItemName', () => {
  it.each(cases)('normalizes $input', ({ input, expected }) => {
    expect(normalizeItemName(input)).toBe(expected);
  });
});
