import { describe, expect, it } from 'vitest';
import { oneLineTitle } from './title';

// The title field wraps (multiline) so large text reads whole; Return submits, but a paste can
// still bring line breaks in.
describe('oneLineTitle', () => {
  it('turns pasted line breaks into spaces', () => {
    expect(oneLineTitle('Regar\nlas plantas')).toBe('Regar las plantas');
    expect(oneLineTitle('Regar\r\nlas\n\nplantas')).toBe('Regar las plantas');
  });

  it('leaves a title without breaks as typed, spaces included', () => {
    expect(oneLineTitle('Regar las plantas ')).toBe('Regar las plantas ');
  });
});
