// The only module that imports expo-notifications: the rest of the app (and the tests) go
// through these few functions.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { t } from '@/i18n';
import type { NotificationPermission, ScheduledReminder } from './plan';

const CHANNEL_ID = 'reminders';
/** Marks our notifications, so a tap on anything else is not taken for a reminder. */
const REMINDER_DATA = { casa: 'reminder' } as const;

// Local notifications do not exist on the web: every call is a quiet no-op there.
const supported = Platform.OS !== 'web';

if (supported) {
  // Shows a reminder that fires while the app is open. On Android the heads-up banner only
  // appears when the sound is allowed.
  Notifications.setNotificationHandler({
    handleNotification: () =>
      Promise.resolve({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
  });
}

// Schedules and cancels run one after another, so a cancel (on sign-out) can never be
// overtaken by a schedule that started before it.
let queue: Promise<void> = Promise.resolve();
function serial(job: () => Promise<void>): Promise<void> {
  const next = queue.then(job, job);
  queue = next.catch(() => undefined);
  return next;
}

export async function getPermission(): Promise<NotificationPermission> {
  if (!supported) return 'denied';
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/** Asks the system once; only called when the user turns reminders on. */
export async function requestPermission(): Promise<boolean> {
  if (!supported) return false;
  const { granted } = await Notifications.requestPermissionsAsync();
  return granted;
}

/** Replaces every scheduled reminder with these, each on its date. */
export function replaceScheduled(reminders: ScheduledReminder[]): Promise<void> {
  if (!supported) return Promise.resolve();
  return serial(async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: t('settings.reminders'),
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const r of reminders) {
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: { title: r.title, body: r.body, data: REMINDER_DATA },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: r.fireAt,
          channelId: CHANNEL_ID,
        },
      });
    }
  });
}

export function cancelAll(): Promise<void> {
  if (!supported) return Promise.resolve();
  return serial(() => Notifications.cancelAllScheduledNotificationsAsync());
}

const isReminder = (response: Notifications.NotificationResponse | null): boolean =>
  response?.notification.request.content.data?.casa === REMINDER_DATA.casa;

/**
 * Calls `cb` when the user taps a reminder, including the tap that opened the app. Returns
 * the unsubscribe function.
 */
export function onReminderTapped(cb: () => void): () => void {
  if (!supported) return () => undefined;
  const launch = Notifications.getLastNotificationResponse();
  if (isReminder(launch)) {
    // Handled once: a later remount must not open Hoy again.
    Notifications.clearLastNotificationResponse();
    cb();
  }
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    if (isReminder(response)) cb();
  });
  return () => subscription.remove();
}
