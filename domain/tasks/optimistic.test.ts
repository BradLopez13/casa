import { describe, expect, it } from 'vitest';
import { applyToggle } from './optimistic';
import type { TaskItem } from './views';

const base: TaskItem = {
  id: 'a',
  seriesId: 's',
  title: 'Task',
  room: null,
  assigneeId: null,
  dueOn: null,
  completedAt: null,
  completedBy: null,
  createdBy: null,
  createdAt: '2026-10-01T00:00:00.000Z',
};
const a = base;
const b: TaskItem = { ...base, id: 'b' };
const now = '2026-10-09T10:00:00.000Z';
const doneA: TaskItem = { ...base, completedAt: now, completedBy: 'me' };

describe('applyToggle', () => {
  it('completes one task and keeps the others by reference', () => {
    const out = applyToggle([a, b], 'a', true, 'me', now);
    expect(out[0]).toMatchObject({ completedAt: now, completedBy: 'me' });
    expect(out[1]).toBe(b);
  });
  it('reopens', () =>
    expect(applyToggle([doneA], 'a', false, 'me', now)[0]).toMatchObject({
      completedAt: null,
      completedBy: null,
    }));
  it('ignores unknown ids', () => {
    const list = [a];
    expect(applyToggle(list, 'x', true, 'me', now)).toBe(list);
  });
});
