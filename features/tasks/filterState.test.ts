import { describe, expect, it } from 'vitest';
import { nextFilter } from './filterState';

describe('nextFilter', () => {
  it('keeps the selected person when tapped again', () => {
    expect(nextFilter('u1', 'u1')).toBe('u1');
  });
  it('goes back to everyone with Todos', () => {
    expect(nextFilter('u1', null)).toBeNull();
  });
  it('switches to another person', () => {
    expect(nextFilter(null, 'u2')).toBe('u2');
    expect(nextFilter('u1', 'u2')).toBe('u2');
  });
});
