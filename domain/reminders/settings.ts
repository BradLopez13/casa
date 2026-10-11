/** Daily reminder preferences; times are local wall-clock 'HH:mm'. */
export type ReminderSettings = { enabled: boolean; morning: string; evening: string };

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  morning: '09:00',
  evening: '20:00',
};

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

const isTime = (v: unknown): v is string => typeof v === 'string' && HH_MM.test(v);

/** Reads stored settings; every missing or invalid field falls back to its default. */
export function parseReminderSettings(raw: unknown): ReminderSettings {
  const obj = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : DEFAULT_REMINDER_SETTINGS.enabled,
    morning: isTime(obj.morning) ? obj.morning : DEFAULT_REMINDER_SETTINGS.morning,
    evening: isTime(obj.evening) ? obj.evening : DEFAULT_REMINDER_SETTINGS.evening,
  };
}
