import { describe, expect, it } from 'vitest';
import { allLine } from './weekLine';
import type { TaskItem } from './views';

const today = '2026-10-09';
const me = 'u-me';
const other = 'u-other';

let seq = 0;
function task(over: Partial<TaskItem> = {}): TaskItem {
  seq += 1;
  return {
    id: `t${seq}`,
    seriesId: `s${seq}`,
    title: `Task ${seq}`,
    room: null,
    assigneeId: null,
    dueOn: today,
    completedAt: null,
    completedBy: null,
    recurrence: null,
    skippedAt: null,
    generatedFrom: null,
    createdBy: null,
    createdAt: new Date(2026, 9, 1, 8, seq).toISOString(),
    ...over,
  };
}

describe('allLine', () => {
  const all = (tasks: TaskItem[], filter: string | null, name = 'Segundo') =>
    allLine({ tasks, today, userId: me, filter, filterName: name });

  it('counts every open task, undated and far ahead included, not done or skipped ones', () => {
    const tasks = [
      task({ assigneeId: me }),
      task({ assigneeId: me, dueOn: '2026-11-20' }),
      task({ assigneeId: me, dueOn: null }),
      task({ assigneeId: me, dueOn: '2026-10-01' }),
      task({ assigneeId: me, completedAt: '2026-10-09T08:00:00Z', completedBy: me }),
      task({ assigneeId: me, skippedAt: '2026-10-09T08:00:00Z' }),
    ];
    expect(all(tasks, null)).toEqual({ kind: 'mine', count: 4 });
  });

  it('says what the household has left when nothing is mine', () => {
    expect(all([task({ dueOn: null }), task({ assigneeId: other })], null)).toEqual({
      kind: 'household',
      household: 2,
    });
  });

  it('is empty when nothing is open', () => {
    expect(all([], null)).toEqual({ kind: 'empty' });
  });

  it('counts the filtered person, and says nothing of mine under my own filter', () => {
    const tasks = [task({ assigneeId: other, dueOn: null }), task({ assigneeId: other })];
    expect(all(tasks, other)).toEqual({ kind: 'person', name: 'Segundo', count: 2 });
    expect(all(tasks, me)).toEqual({ kind: 'nothingMine' });
  });
});
