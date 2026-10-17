import { describe, expect, it } from 'vitest';
import { quickAddInput } from './quickAddInput';

describe('quickAddInput', () => {
  it('builds a plain task for the given person and day', () => {
    expect(quickAddInput('Sacar la basura', 'u1', '2026-10-17')).toEqual({
      title: 'Sacar la basura',
      room: null,
      assigneeId: 'u1',
      dueOn: '2026-10-17',
      recurrence: null,
    });
  });

  it('trims the title', () => {
    expect(quickAddInput('  Regar  ', null, '2026-10-17')?.title).toBe('Regar');
  });

  it('is null for empty or blank text', () => {
    expect(quickAddInput('', 'u1', '2026-10-17')).toBeNull();
    expect(quickAddInput('   ', 'u1', '2026-10-17')).toBeNull();
  });
});
