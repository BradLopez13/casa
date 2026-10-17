import { describe, expect, it } from 'vitest';
import type { Reminder } from '@/domain/reminders/schedule';
import { DEFAULT_REMINDER_SETTINGS } from '@/domain/reminders/settings';
import { reminderPlan, reminderText } from './plan';

const on = { ...DEFAULT_REMINDER_SETTINGS, enabled: true };
const ready = {
  signedIn: true,
  hasHousehold: true,
  permission: 'granted' as const,
  settings: on,
};

describe('reminderPlan', () => {
  it('schedules when signed in, in a household, allowed and enabled', () => {
    expect(reminderPlan(ready)).toBe('schedule');
  });

  it('cancels without a session', () => {
    expect(reminderPlan({ ...ready, signedIn: false })).toBe('cancel');
  });

  it('cancels without a household', () => {
    expect(reminderPlan({ ...ready, hasHousehold: false })).toBe('cancel');
  });

  it('cancels when the permission is denied', () => {
    expect(reminderPlan({ ...ready, permission: 'denied' })).toBe('cancel');
  });

  it('cancels when the permission was never asked', () => {
    expect(reminderPlan({ ...ready, permission: 'undetermined' })).toBe('cancel');
  });

  it('cancels when reminders are off', () => {
    expect(reminderPlan({ ...ready, settings: DEFAULT_REMINDER_SETTINGS })).toBe('cancel');
  });
});

const reminder = (over: Partial<Reminder>): Reminder => ({
  id: 'morning-2026-10-12',
  fireAt: new Date(2026, 9, 12, 9, 0),
  kind: 'morning',
  date: '2026-10-12',
  count: 1,
  overdue: 0,
  titles: ['Fregar'],
  ...over,
});

describe('reminderText', () => {
  it('keeps the id and fire time', () => {
    const r = reminder({});
    expect(reminderText(r)).toMatchObject({ id: r.id, fireAt: r.fireAt });
  });

  it('morning with one task', () => {
    expect(reminderText(reminder({})).title).toBe('Hoy tienes 1 tarea');
  });

  it('morning with several tasks and overdue ones', () => {
    const r = reminder({ count: 4, overdue: 2, titles: ['A', 'B', 'C'] });
    expect(reminderText(r)).toMatchObject({
      title: 'Hoy tienes 4 tareas (2 pendientes de otros días)',
      body: 'A, B, C',
    });
  });

  it('morning with exactly one overdue task', () => {
    expect(reminderText(reminder({ count: 2, overdue: 1 })).title).toBe(
      'Hoy tienes 2 tareas (1 pendiente de otro día)',
    );
  });

  it('evening with one and several tasks', () => {
    expect(reminderText(reminder({ kind: 'evening' })).title).toBe('Te queda 1 tarea de hoy');
    expect(reminderText(reminder({ kind: 'evening', count: 3 })).title).toBe(
      'Te quedan 3 tareas de hoy',
    );
  });
});
