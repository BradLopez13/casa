import { describe, expect, it } from 'vitest';
import type { TaskInput } from '@/features/tasks/api';
import { isDirty } from './isDirty';

const input: TaskInput = {
  title: 'Sacar la basura',
  room: null,
  assigneeId: null,
  dueOn: '2026-10-17',
  recurrence: { kind: 'weekly', interval: 1, days: [1, 3] } as unknown as TaskInput['recurrence'],
};

describe('isDirty', () => {
  it('ignores untouched forms', () => {
    expect(isDirty(input, { ...input })).toBe(false);
  });

  it('detects a changed title', () => {
    expect(isDirty(input, { ...input, title: 'Otra' })).toBe(true);
  });

  it('compares nested values by content, not identity', () => {
    const same = { ...input, recurrence: JSON.parse(JSON.stringify(input.recurrence)) as never };
    expect(isDirty(input, same)).toBe(false);
    const other = {
      ...input,
      recurrence: {
        kind: 'weekly',
        interval: 1,
        days: [1, 4],
      } as unknown as TaskInput['recurrence'],
    };
    expect(isDirty(input, other)).toBe(true);
  });

  it('detects a field cleared to null', () => {
    expect(isDirty(input, { ...input, dueOn: null })).toBe(true);
  });
});
