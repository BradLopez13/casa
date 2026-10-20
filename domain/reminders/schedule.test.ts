import { describe, expect, it } from 'vitest';
import type { TaskItem } from '@/domain/tasks/views';
import { scheduleReminders } from './schedule';
import type { ReminderSettings } from './settings';

const ME = 'me';
const OTHER = 'other';
const TODAY = '2026-10-11';
const NOW = new Date(2026, 9, 11, 8, 0);
const ON: ReminderSettings = { enabled: true, morning: '09:00', evening: '20:00' };

let seq = 0;
function task(over: Partial<TaskItem> = {}): TaskItem {
  seq += 1;
  return {
    id: `t${seq}`,
    seriesId: `s${seq}`,
    title: `Task ${seq}`,
    room: null,
    assigneeId: ME,
    dueOn: null,
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
  task({ completedAt: new Date(2026, 9, 11, 7, 0).toISOString(), ...over });

function run(
  tasks: TaskItem[],
  over: Partial<{ today: string; now: Date; settings: ReminderSettings; days: number }> = {},
) {
  return scheduleReminders({
    tasks,
    userId: ME,
    today: TODAY,
    now: NOW,
    settings: ON,
    days: 8,
    ...over,
  });
}

const find = (rs: ReturnType<typeof run>, id: string) => rs.find((r) => r.id === id);

describe('scheduleReminders', () => {
  it('nothing to do → no reminders', () => {
    expect(run([])).toEqual([]);
  });

  it('only other people’s tasks → no reminders', () => {
    expect(run([task({ assigneeId: OTHER, dueOn: TODAY })])).toEqual([]);
  });

  it('disabled → no reminders even with pending tasks', () => {
    expect(run([task({ dueOn: TODAY })], { settings: { ...ON, enabled: false } })).toEqual([]);
  });

  it('morning counts overdue plus today; evening only today', () => {
    const overdue = task({ dueOn: '2026-10-09', title: 'Old' });
    const a = task({ dueOn: TODAY, title: 'A' });
    const b = task({ dueOn: TODAY, title: 'B', assigneeId: null });
    const rs = run([b, a, overdue]);

    expect(find(rs, 'morning-2026-10-11')).toEqual({
      id: 'morning-2026-10-11',
      fireAt: new Date(2026, 9, 11, 9, 0),
      kind: 'morning',
      date: TODAY,
      count: 3,
    });
    expect(find(rs, 'evening-2026-10-11')).toEqual({
      id: 'evening-2026-10-11',
      fireAt: new Date(2026, 9, 11, 20, 0),
      kind: 'evening',
      date: TODAY,
      count: 2,
    });
    // Nothing on the following days.
    expect(rs).toHaveLength(2);
  });

  it('evening never counts overdue tasks', () => {
    const rs = run([task({ dueOn: '2026-10-09' })]);
    expect(rs.map((r) => r.id)).toEqual(['morning-2026-10-11']);
  });

  it('everything today done → no evening reminder for today', () => {
    const rs = run([
      done({ dueOn: TODAY }),
      task({ dueOn: TODAY, skippedAt: '2026-10-11T07:00:00Z' }),
    ]);
    expect(find(rs, 'evening-2026-10-11')).toBeUndefined();
    expect(find(rs, 'morning-2026-10-11')).toBeUndefined();
  });

  it('drops reminders whose time has already passed', () => {
    const rs = run([task({ dueOn: TODAY }), task({ dueOn: '2026-10-12' })], {
      now: new Date(2026, 9, 11, 21, 0),
    });
    expect(rs.filter((r) => r.date === TODAY)).toEqual([]);
    expect(rs.map((r) => r.id)).toEqual(['morning-2026-10-12', 'evening-2026-10-12']);
  });

  it('a future day counts only its own tasks, never the overdue ones', () => {
    const rs = run([task({ dueOn: '2026-10-09' }), task({ dueOn: '2026-10-14' })]);
    expect(find(rs, 'morning-2026-10-14')).toMatchObject({ count: 1 });
  });

  it('projects a weekly unassigned series forward, skipping days without a rule date', () => {
    const tuesdays = task({
      assigneeId: null,
      title: 'Bins',
      dueOn: '2026-10-13',
      recurrence: { kind: 'weekly', days: [2] },
    });
    // 8 days from the 11th end on the 18th; widen the window so the 20th is inside.
    const rs = run([tuesdays], { days: 14 });
    expect(rs.map((r) => r.id)).toEqual([
      'morning-2026-10-13',
      'evening-2026-10-13',
      'morning-2026-10-20',
      'evening-2026-10-20',
    ]);
    expect(find(rs, 'morning-2026-10-20')).toMatchObject({ count: 1 });
    expect(find(rs, 'morning-2026-10-14')).toBeUndefined();
  });

  it('stops projecting at the end of the window', () => {
    const tuesdays = task({ dueOn: '2026-10-13', recurrence: { kind: 'weekly', days: [2] } });
    expect(run([tuesdays]).map((r) => r.date)).toEqual(['2026-10-13', '2026-10-13']);
  });

  it('projected occurrences inherit the assignee', () => {
    const theirs = task({
      assigneeId: OTHER,
      dueOn: TODAY,
      recurrence: { kind: 'interval', every: 1 },
    });
    expect(run([theirs])).toEqual([]);
  });

  it('does not double count a day that already has an occurrence of the series', () => {
    const rule = { kind: 'interval', every: 1 } as const;
    const first = task({ dueOn: TODAY, recurrence: rule, title: 'Dishes' });
    const second = task({
      dueOn: '2026-10-12',
      recurrence: rule,
      seriesId: first.seriesId,
      generatedFrom: first.id,
      title: 'Dishes',
    });
    const rs = run([first, second]);
    expect(find(rs, 'morning-2026-10-12')).toMatchObject({ count: 1 });
    expect(find(rs, 'evening-2026-10-12')).toMatchObject({ count: 1 });
    // Projected daily through the end of the 8-day window.
    expect(find(rs, 'morning-2026-10-18')).toMatchObject({ count: 1 });
    expect(find(rs, 'morning-2026-10-19')).toBeUndefined();
  });

  it('a completed occurrence on a date blocks the projection onto that date', () => {
    const rule = { kind: 'interval', every: 1 } as const;
    const first = task({ dueOn: TODAY, recurrence: rule });
    const doneTomorrow = done({ dueOn: '2026-10-12', recurrence: rule, seriesId: first.seriesId });
    const rs = run([first, doneTomorrow]);
    expect(find(rs, 'morning-2026-10-12')).toBeUndefined();
    expect(find(rs, 'morning-2026-10-13')).toMatchObject({ count: 1 });
  });

  it('does not project from an overdue occurrence', () => {
    const late = task({ dueOn: '2026-10-09', recurrence: { kind: 'interval', every: 1 } });
    expect(run([late]).map((r) => r.id)).toEqual(['morning-2026-10-11']);
  });

  it('keeps the wall-clock hour across the clock change', () => {
    const rs = run([task({ dueOn: '2026-10-24' }), task({ dueOn: '2026-10-26' })], {
      today: '2026-10-24',
      now: new Date(2026, 9, 24, 8, 0),
    });
    const after = find(rs, 'morning-2026-10-26');
    expect(after?.fireAt.getHours()).toBe(9);
    expect(after?.fireAt.getMinutes()).toBe(0);
    expect(after?.fireAt).toEqual(new Date(2026, 9, 26, 9, 0));
    expect(find(rs, 'evening-2026-10-26')?.fireAt.getHours()).toBe(20);
  });

  it('terminates on a malformed rule that never advances', () => {
    const bad = task({
      dueOn: TODAY,
      recurrence: { kind: 'interval', every: 0 } as unknown as TaskItem['recurrence'],
    });
    expect(run([bad]).length).toBeGreaterThan(0);
  });

  it('uses the configured times', () => {
    const rs = run([task({ dueOn: TODAY })], {
      settings: { enabled: true, morning: '08:30', evening: '19:45' },
    });
    expect(rs.map((r) => r.fireAt)).toEqual([
      new Date(2026, 9, 11, 8, 30),
      new Date(2026, 9, 11, 19, 45),
    ]);
  });
});
