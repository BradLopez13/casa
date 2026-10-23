import { describe, expect, it } from 'vitest';
import { assigneeParam, dueParam } from './dueParam';

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

describe('assigneeParam', () => {
  it('takes a user id from the link', () => {
    expect(assigneeParam('22d75389-90b3-455c-bf9d-872268648dd5')).toBe(
      '22d75389-90b3-455c-bf9d-872268648dd5',
    );
  });

  it('gives the task to nobody when the link brings something that is not an id', () => {
    expect(assigneeParam('bo')).toBeNull();
    expect(assigneeParam(['a', 'b'])).toBeNull();
    expect(assigneeParam(undefined)).toBeNull();
  });
});
