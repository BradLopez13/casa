import { describe, expect, it } from 'vitest';
import { tallyToday } from './tally';
import type { TaskItem } from './views';

const today = '2026-10-09';

let seq = 0;
function task(over: Partial<TaskItem> = {}): TaskItem {
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

const doneOn = (day: number, over: Partial<TaskItem> = {}) =>
  task({ completedAt: new Date(2026, 9, day, 10, 0).toISOString(), ...over });

describe('tallyToday', () => {
  it('counts overdue, due today and done today', () => {
    const overdueOpen = task({ dueOn: '2026-10-07' });
    const todayOpen = task({ dueOn: today });
    const doneToday = doneOn(9, { dueOn: today });
    const tomorrowOpen = task({ dueOn: '2026-10-10' });
    const doneYesterday = doneOn(8, { dueOn: '2026-10-08' });
    expect(
      tallyToday([overdueOpen, todayOpen, doneToday, tomorrowOpen, doneYesterday], today),
    ).toEqual({ done: 1, total: 3 });
  });

  it('is zero with nothing for today', () => {
    expect(tallyToday([], today)).toEqual({ done: 0, total: 0 });
  });
});
