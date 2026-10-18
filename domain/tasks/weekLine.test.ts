import { describe, expect, it } from 'vitest';
import { weekLine } from './weekLine';
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

const line = (tasks: TaskItem[], filter: string | null, name = 'Segundo') =>
  weekLine({ tasks, today, userId: me, filter, filterName: name });

describe('weekLine', () => {
  it('counts the seven days from today and what is overdue, not later or undated tasks', () => {
    const tasks = [
      task({ assigneeId: me }),
      task({ assigneeId: me, dueOn: '2026-10-15' }),
      task({ assigneeId: me, dueOn: '2026-10-02' }),
      task({ assigneeId: me, dueOn: '2026-10-16' }),
      task({ assigneeId: me, dueOn: null }),
    ];
    expect(line(tasks, null)).toEqual({ kind: 'mine', count: 3 });
  });

  it('leaves out done and skipped tasks', () => {
    const tasks = [
      task({ assigneeId: me, completedAt: new Date(2026, 9, 9).toISOString() }),
      task({ assigneeId: me, skippedAt: new Date(2026, 9, 9).toISOString() }),
      task({ assigneeId: me, dueOn: '2026-10-11' }),
    ];
    expect(line(tasks, null)).toEqual({ kind: 'mine', count: 1 });
  });

  it('all filter, nothing mine: what is left for the household', () => {
    expect(line([task({ assigneeId: other }), task({ dueOn: '2026-10-12' })], null)).toEqual({
      kind: 'household',
      household: 2,
    });
  });

  it('nothing this week at all', () => {
    expect(line([task({ dueOn: '2026-11-01' })], null)).toEqual({ kind: 'empty' });
    expect(line([], me)).toEqual({ kind: 'empty' });
  });

  it('filter on me: mine, or nothing mine', () => {
    expect(line([task({ assigneeId: me }), task({ assigneeId: other })], me)).toEqual({
      kind: 'mine',
      count: 1,
    });
    expect(line([task({ assigneeId: other })], me)).toEqual({ kind: 'nothingMine' });
  });

  it('filter on someone else: their count with their name', () => {
    const tasks = [task({ assigneeId: other }), task({ assigneeId: other, dueOn: '2026-10-13' })];
    expect(line(tasks, other)).toEqual({ kind: 'person', name: 'Segundo', count: 2 });
    expect(line([task({ assigneeId: me })], other)).toEqual({
      kind: 'person',
      name: 'Segundo',
      count: 0,
    });
  });

  it('signed out (no user): nothing is mine', () => {
    expect(
      weekLine({ tasks: [task()], today, userId: null, filter: null, filterName: '' }),
    ).toEqual({ kind: 'household', household: 1 });
  });
});
