import { describe, expect, it } from 'vitest';
import { localDateIso } from './dates';
import { filterMine, selectAll, selectToday, selectWeek, type TaskItem } from './views';

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

const done = (h: number, over: Partial<TaskItem> = {}) =>
  task({ completedAt: new Date(2026, 9, 4, h, 0).toISOString(), ...over });

describe('selectToday', () => {
  it('task due today is in dueToday at 23:59 and overdue at 00:00 next day', () => {
    const a = task({ dueOn: '2026-10-04' });
    const evening = localDateIso(new Date(2026, 9, 4, 23, 59));
    expect(selectToday([a], evening).dueToday).toEqual([a]);
    expect(selectToday([a], evening).overdue).toEqual([]);
    const nextMidnight = localDateIso(new Date(2026, 9, 5, 0, 0));
    expect(selectToday([a], nextMidnight).overdue).toEqual([a]);
    expect(selectToday([a], nextMidnight).dueToday).toEqual([]);
  });

  it('task due tomorrow enters dueToday at 00:00', () => {
    const a = task({ dueOn: '2026-10-05' });
    expect(selectToday([a], localDateIso(new Date(2026, 9, 4, 23, 59))).dueToday).toEqual([]);
    expect(selectToday([a], localDateIso(new Date(2026, 9, 5, 0, 0))).dueToday).toEqual([a]);
  });

  it('undated tasks never appear in today or week', () => {
    const a = task();
    const today = selectToday([a], '2026-10-04');
    expect([...today.overdue, ...today.dueToday, ...today.doneToday]).toEqual([]);
    const week = selectWeek([a], '2026-10-04');
    expect(week.overdue).toEqual([]);
    expect(week.days.flatMap((d) => d.tasks)).toEqual([]);
  });

  it('sorts overdue by dueOn and dueToday by createdAt', () => {
    const late = task({ dueOn: '2026-10-03' });
    const later = task({ dueOn: '2026-10-01' });
    const second = task({ dueOn: '2026-10-04', createdAt: new Date(2026, 9, 2).toISOString() });
    const first = task({ dueOn: '2026-10-04', createdAt: new Date(2026, 9, 1).toISOString() });
    const r = selectToday([late, later, second, first], '2026-10-04');
    expect(r.overdue).toEqual([later, late]);
    expect(r.dueToday).toEqual([first, second]);
  });

  it('doneToday uses the local date of completedAt, newest first', () => {
    const morning = done(8);
    const evening = done(22);
    const yesterday = task({ completedAt: new Date(2026, 9, 3, 23, 59).toISOString() });
    const r = selectToday([morning, yesterday, evening], '2026-10-04');
    expect(r.doneToday).toEqual([evening, morning]);
  });

  it('completed tasks are excluded from overdue and dueToday', () => {
    const a = done(9, { dueOn: '2026-10-03' });
    const b = done(9, { dueOn: '2026-10-04' });
    const r = selectToday([a, b], '2026-10-04');
    expect(r.overdue).toEqual([]);
    expect(r.dueToday).toEqual([]);
  });
});

describe('selectWeek', () => {
  it('week has 7 days from today and excludes day 7', () => {
    const inside = task({ dueOn: '2026-10-10' });
    const outside = task({ dueOn: '2026-10-11' });
    const w = selectWeek([inside, outside], '2026-10-04');
    expect(w.days).toHaveLength(7);
    expect(w.days.map((d) => d.date)).toEqual([
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
    ]);
    expect(w.days[6]?.tasks).toEqual([inside]);
    expect(w.days.flatMap((d) => d.tasks)).not.toContain(outside);
  });

  it('completed tasks are excluded from overdue and week', () => {
    const a = done(9, { dueOn: '2026-10-02' });
    const b = done(9, { dueOn: '2026-10-05' });
    const w = selectWeek([a, b], '2026-10-04');
    expect(w.overdue).toEqual([]);
    expect(w.days.flatMap((d) => d.tasks)).toEqual([]);
  });

  it('puts overdue apart, ordered by dueOn', () => {
    const a = task({ dueOn: '2026-10-02' });
    const b = task({ dueOn: '2026-10-01' });
    expect(selectWeek([a, b], '2026-10-04').overdue).toEqual([b, a]);
  });
});

describe('selectAll', () => {
  it('selectAll sorts dated ascending, undated by createdAt, done newest first', () => {
    const d2 = task({ dueOn: '2026-10-09' });
    const d1 = task({ dueOn: '2026-10-02' });
    const u2 = task({ createdAt: new Date(2026, 9, 3).toISOString() });
    const u1 = task({ createdAt: new Date(2026, 9, 2).toISOString() });
    const old = done(8);
    const recent = done(20);
    const r = selectAll([d2, u2, old, d1, recent, u1], '2026-10-04');
    expect(r.dated).toEqual([d1, d2]);
    expect(r.undated).toEqual([u1, u2]);
    expect(r.done).toEqual([recent, old]);
  });
});

describe('filterMine', () => {
  it('filterMine keeps only my assigned tasks', () => {
    const mine = task({ assigneeId: 'me' });
    const theirs = task({ assigneeId: 'other' });
    const nobody = task();
    expect(filterMine([mine, theirs, nobody], 'me')).toEqual([mine]);
  });
});

describe('timestamp ordering', () => {
  // As strings '...:00.5+00:00' < '...:00+00:00' ('.' < '+'), yet 10:00:00.5 is later.
  const plain = '2026-10-05T10:00:00+00:00';
  const fractional = '2026-10-05T10:00:00.5+00:00';

  it('orders createdAt in Supabase format by instant', () => {
    const early = task({ createdAt: plain });
    const late = task({ createdAt: fractional });
    expect(selectAll([late, early], '2026-10-05').undated).toEqual([early, late]);
  });

  it('orders completedAt in Supabase format by instant', () => {
    const early = task({ completedAt: plain });
    const late = task({ completedAt: fractional });
    expect(selectAll([early, late], '2026-10-05').done).toEqual([late, early]);
  });
});
