import { describe, expect, it } from 'vitest';
import { weekStrip } from './strip';
import type { TaskItem } from './views';

const today = '2026-10-09';

let seq = 0;
function base(over: Partial<TaskItem> = {}): TaskItem {
  seq += 1;
  return {
    id: `t${seq}`,
    seriesId: `s${seq}`,
    title: `Task ${seq}`,
    room: null,
    assigneeId: null,
    dueOn: null,
    completedAt: null,
    completedBy: null,
    createdBy: null,
    createdAt: new Date(2026, 9, 1, 8, seq).toISOString(),
    ...over,
  };
}

const task = (assigneeId: string | null, dueOn: string) => base({ assigneeId, dueOn });
const done = (assigneeId: string | null, dueOn: string) =>
  base({ assigneeId, dueOn, completedAt: new Date(2026, 9, 9, 10, 0).toISOString() });

describe('weekStrip', () => {
  it('lists seven days starting today', () => {
    expect(weekStrip([], today, []).map((d) => d.date)).toEqual([
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
    ]);
  });

  it('orders people by join order without duplicates', () => {
    const [day] = weekStrip([task('b', today), task('a', today), task('b', today)], today, [
      'a',
      'b',
    ]);
    expect(day?.people).toEqual(['a', 'b']);
  });

  it('drops assignees who are no longer members', () => {
    expect(weekStrip([task('gone', today)], today, ['a'])[0]).toEqual({
      date: today,
      people: [],
      unassigned: false,
    });
  });

  it('flags unassigned open tasks and ignores done ones', () => {
    const [day] = weekStrip([task(null, today), done('a', today)], today, ['a']);
    expect(day).toEqual({ date: today, people: [], unassigned: true });
  });
});
