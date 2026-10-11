import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_REMINDER_SETTINGS,
  parseReminderSettings,
  type ReminderSettings,
} from '@/domain/reminders/settings';

// Per user: another account on the same phone starts with reminders off.
const keyFor = (userId: string) => `casa-reminders:${userId}`;

/** The user's reminder settings on this device; anything unreadable gives the defaults. */
export async function loadReminderSettings(userId: string): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    return raw === null ? DEFAULT_REMINDER_SETTINGS : parseReminderSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_REMINDER_SETTINGS;
  }
}

export async function saveReminderSettings(userId: string, s: ReminderSettings): Promise<void> {
  await AsyncStorage.setItem(keyFor(userId), JSON.stringify(s));
}
