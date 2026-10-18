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
  ...over,
});

describe('reminderText', () => {
  it('keeps the id and fire time', () => {
    const r = reminder({});
    expect(reminderText(r)).toMatchObject({ id: r.id, fireAt: r.fireAt });
  });

  it('morning: never counts nor names tasks, so it cannot go stale', () => {
    for (const count of [1, 4]) {
      expect(reminderText(reminder({ count }))).toMatchObject({
        title: 'Tus tareas de hoy',
        body: 'Mira lo que te toca.',
      });
    }
  });

  it('evening: same text whatever is left', () => {
    for (const count of [1, 3]) {
      expect(reminderText(reminder({ kind: 'evening', count }))).toMatchObject({
        title: 'Antes de cerrar el día',
        body: 'Mira si te queda algo de hoy.',
      });
    }
  });
});
