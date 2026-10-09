import { describe, expect, it } from 'vitest';
import { applyToggle, isProvisional, provisionalId } from './optimistic';
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
  recurrence: null,
  skippedAt: null,
  generatedFrom: null,
  createdBy: null,
  createdAt: '2026-10-01T00:00:00.000Z',
};
const a = base;
const b: TaskItem = { ...base, id: 'b' };
const now = '2026-10-09T10:00:00.000Z';
const today = '2026-10-09';
const doneA: TaskItem = { ...base, completedAt: now, completedBy: 'me' };

describe('applyToggle', () => {
  it('completes one task and keeps the others by reference', () => {
    const out = applyToggle([a, b], 'a', true, 'me', now, today);
    expect(out[0]).toMatchObject({ completedAt: now, completedBy: 'me' });
    expect(out[1]).toBe(b);
  });
  it('reopens', () =>
    expect(applyToggle([doneA], 'a', false, 'me', now, today)[0]).toMatchObject({
      completedAt: null,
      completedBy: null,
    }));
  it('ignores unknown ids', () => {
    const list = [a];
    expect(applyToggle(list, 'x', true, 'me', now, today)).toBe(list);
  });

  describe('recurring', () => {
    const daily: TaskItem = {
      ...base,
      id: 'r',
      assigneeId: 'ana',
      dueOn: '2026-10-09',
      recurrence: { kind: 'interval', every: 1 },
    };

    it('adds a provisional next occurrence when completing', () => {
      const out = applyToggle([daily, b], 'r', true, 'me', now, today);
      expect(out).toHaveLength(3);
      expect(out[1]).toBe(b);
      expect(out[2]).toEqual({
        ...daily,
        id: provisionalId('r'),
        dueOn: '2026-10-10',
        generatedFrom: 'r',
        createdAt: now,
      });
      expect(out[2]?.assigneeId).toBe('ana');
      expect(isProvisional(out[2] as TaskItem)).toBe(true);
      expect(isProvisional(daily)).toBe(false);
    });

    it('does not add a second one when completing twice', () => {
      const once = applyToggle([daily], 'r', true, 'me', now, today);
      expect(applyToggle(once, 'r', true, 'me', now, today)).toHaveLength(2);
    });

    it('removes the next occurrence when reopening', () => {
      const once = applyToggle([daily, b], 'r', true, 'me', now, today);
      const out = applyToggle(once, 'r', false, 'me', now, today);
      expect(out.map((task) => task.id)).toEqual(['r', 'b']);
      expect(out[0]?.completedAt).toBeNull();
    });

    it('adds nothing when completing a one-off task', () =>
      expect(applyToggle([a], 'a', true, 'me', now, today)).toHaveLength(1));
  });
});
