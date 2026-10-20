import type { Reminder } from '@/domain/reminders/schedule';
import type { ReminderSettings } from '@/domain/reminders/settings';
import { t } from '@/i18n';

export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

export type ScheduledReminder = { id: string; fireAt: Date; title: string; body: string };

/** Whether reminders should be (re)scheduled or only cleared. Pure, so it can be tested. */
export function reminderPlan(input: {
  signedIn: boolean;
  hasHousehold: boolean;
  permission: NotificationPermission;
  settings: ReminderSettings;
}): 'schedule' | 'cancel' {
  const { signedIn, hasHousehold, permission, settings } = input;
  return signedIn && hasHousehold && permission === 'granted' && settings.enabled
    ? 'schedule'
    : 'cancel';
}

/**
 * The notification text for a reminder. It is scheduled up to a week ahead and the tasks can
 * change before it fires (someone else does them, new ones get assigned), so it neither counts
 * nor names them: it can never go stale. Nor does it name a person.
 */
export function reminderText(r: Reminder): ScheduledReminder {
  const morning = r.kind === 'morning';
  return {
    id: r.id,
    fireAt: r.fireAt,
    title: t(morning ? 'reminders.morningTitle' : 'reminders.eveningTitle'),
    body: t(morning ? 'reminders.morningBody' : 'reminders.eveningBody'),
  };
}
