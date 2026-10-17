import { describe, expect, it } from 'vitest';

import { householdLine } from './householdLine';

describe('householdLine', () => {
  it('names only the household when you are alone', () => {
    expect(householdLine('Casa', [])).toBe('Hogar Casa');
  });

  it('names the one other member', () => {
    expect(householdLine('Casa', ['Bob'])).toBe('Hogar Casa, con Bob');
  });

  it('joins two with «y»', () => {
    expect(householdLine('Casa', ['Bob', 'Eva'])).toBe('Hogar Casa, con Bob y Eva');
  });

  it('joins three or more with commas and a final «y»', () => {
    expect(householdLine('Casa', ['Bob', 'Eva', 'Leo', 'Zoe'])).toBe(
      'Hogar Casa, con Bob, Eva, Leo y Zoe',
    );
  });
});
