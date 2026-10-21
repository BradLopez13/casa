import { describe, expect, it } from 'vitest';
import { todayLine } from './todayLine';
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
const done = (over: Partial<TaskItem> = {}) =>
  task({ completedAt: new Date(2026, 9, 9, 10, 0).toISOString(), ...over });

const line = (tasks: TaskItem[], filter: string | null, name = 'Segundo') =>
  todayLine({ tasks, today, userId: me, filter, filterName: name });

describe('todayLine', () => {
  it('all filter, something for me: mine plus the household remainder', () => {
    const tasks = [
      task({ assigneeId: me }),
      task({ assigneeId: me, dueOn: '2026-10-05' }),
      task({ assigneeId: other }),
      task(),
    ];
    expect(line(tasks, null)).toEqual({ kind: 'mine', today: 1, overdue: 1, household: 2 });
  });

  it('all filter, only overdue for me: today 0, so the door can say «Nada para hoy»', () => {
    expect(line([task({ assigneeId: me, dueOn: '2026-10-05' })], null)).toEqual({
      kind: 'mine',
      today: 0,
      overdue: 1,
      household: 0,
    });
  });

  it('all filter, one mine and one left for the household', () => {
    expect(line([task({ assigneeId: me }), task({ assigneeId: other })], null)).toEqual({
      kind: 'mine',
      today: 1,
      overdue: 0,
      household: 1,
    });
  });

  it('all filter, nothing mine: only the household remainder', () => {
    expect(line([task({ assigneeId: other }), task()], null)).toEqual({
      kind: 'household',
      household: 2,
    });
  });

  it('filter me: how many are mine, without the household', () => {
    expect(line([task({ assigneeId: me }), task({ assigneeId: other })], me)).toEqual({
      kind: 'mine',
      today: 1,
      overdue: 0,
      household: null,
    });
  });

  it('filter me, nothing mine but unassigned pending', () => {
    expect(line([task({ assigneeId: other }), task(), task()], me)).toEqual({
      kind: 'nothingMine',
      unassigned: 2,
    });
  });

  it('filter me, nothing mine and nothing unassigned but others pending', () => {
    expect(line([task({ assigneeId: other })], me)).toEqual({ kind: 'nothingMine', unassigned: 0 });
  });

  it('filter another person: how many are theirs', () => {
    expect(
      line(
        [task({ assigneeId: other }), task({ assigneeId: other }), task({ assigneeId: me })],
        other,
      ),
    ).toEqual({ kind: 'person', name: 'Segundo', count: 2 });
  });

  it('filter another person with nothing theirs', () => {
    expect(line([task({ assigneeId: me })], other)).toEqual({
      kind: 'person',
      name: 'Segundo',
      count: 0,
    });
  });

  it('nothing pending but something done today: all done, whatever the filter', () => {
    const tasks = [done({ assigneeId: me })];
    expect(line(tasks, null)).toEqual({ kind: 'allDone' });
    expect(line(tasks, me)).toEqual({ kind: 'allDone' });
    expect(line(tasks, other)).toEqual({ kind: 'allDone' });
  });

  it('nothing at all: empty', () => {
    expect(line([], null)).toEqual({ kind: 'empty' });
    expect(
      line([task({ dueOn: '2026-10-12' }), done({ completedAt: '2026-10-08T10:00:00' })], me),
    ).toEqual({
      kind: 'empty',
    });
  });

  it('ignores tasks due later and tasks done on other days', () => {
    expect(line([task({ assigneeId: me, dueOn: '2026-10-10' })], null)).toEqual({ kind: 'empty' });
  });
});
