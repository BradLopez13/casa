import { describe, expect, it } from 'vitest';
import { glyphSize } from './glyphSize';

describe('glyphSize', () => {
  it('keeps the base size at the default text size', () => {
    expect(glyphSize(16, 1)).toBe(16);
  });

  it('grows with large system text, like the label beside it', () => {
    expect(glyphSize(16, 1.6)).toBe(26);
    expect(glyphSize(16, 2)).toBe(32);
  });

  it('never shrinks below the base with small text', () => {
    expect(glyphSize(16, 0.85)).toBe(16);
  });
});
