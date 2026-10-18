import { describe, expect, it } from 'vitest';
import type { TaskInput } from '../api';
import { openFieldFor } from './formState';

const input: TaskInput = {
  title: '',
  room: null,
  assigneeId: null,
  dueOn: '2026-10-17',
  recurrence: null,
};

describe('openFieldFor', () => {
  it('opens the day picker on a new task', () => {
    expect(openFieldFor(input, true)).toBe('due');
  });
  it('opens nothing when editing a task', () => {
    expect(openFieldFor({ ...input, title: 'Regar' }, false)).toBeNull();
  });
});
