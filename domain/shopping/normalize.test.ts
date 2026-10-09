import { describe, expect, it } from 'vitest';
import cases from './normalize-cases.json';
import { normalizeItemName, trimItemText } from './normalize';

describe('normalizeItemName', () => {
  it.each(cases)('normalizes $input', ({ input, expected }) => {
    expect(normalizeItemName(input)).toBe(expected);
  });
});

describe('trimItemText', () => {
  it('trims only the pinned whitespace class', () => {
    expect(trimItemText(' \t\n\r\f\v\u00a0Leche\u00a0 ')).toBe('Leche');
    expect(trimItemText('\ufeffLeche')).toBe('\ufeffLeche');
  });
});
