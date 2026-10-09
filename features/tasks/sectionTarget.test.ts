import { describe, expect, it } from 'vitest';
import { sectionIndexFor } from './sectionTarget';

describe('sectionIndexFor', () => {
  const sections = [{ key: 'overdue' }, { key: '2026-10-09' }, { key: '2026-10-11' }];

  it('finds the section of a day', () => {
    expect(sectionIndexFor('2026-10-11', sections)).toBe(2);
  });

  it('returns null for a day with no section', () => {
    expect(sectionIndexFor('2026-10-10', sections)).toBeNull();
  });

  it('returns null once the sections are gone', () => {
    expect(sectionIndexFor('2026-10-09', [])).toBeNull();
  });
});
