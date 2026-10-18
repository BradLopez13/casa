import { describe, expect, it } from 'vitest';
import { dueParam } from './dueParam';

describe('dueParam', () => {
  it('keeps a date', () => {
    expect(dueParam('2026-10-20', '2026-10-18')).toBe('2026-10-20');
  });

  it('falls back to today', () => {
    expect(dueParam('nope', '2026-10-18')).toBe('2026-10-18');
    expect(dueParam(undefined, '2026-10-18')).toBe('2026-10-18');
    expect(dueParam(['2026-10-20'], '2026-10-18')).toBe('2026-10-18');
  });
});
