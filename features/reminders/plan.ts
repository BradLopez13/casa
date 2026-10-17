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

function overdueSuffix(overdue: number): string {
  if (overdue === 0) return '';
  return overdue === 1
    ? t('reminders.overdueSuffixOne')
    : t('reminders.overdueSuffix', { overdue });
}

/** The notification text for a reminder. It names tasks only, never a person. */
export function reminderText(r: Reminder): ScheduledReminder {
  const { count } = r;
  const title =
    r.kind === 'morning'
      ? (count === 1
          ? t('reminders.morningTitleOne')
          : t('reminders.morningTitleOther', { count })) + overdueSuffix(r.overdue)
      : count === 1
        ? t('reminders.eveningTitleOne')
        : t('reminders.eveningTitleOther', { count });
  return { id: r.id, fireAt: r.fireAt, title, body: r.titles.join(', ') };
}
