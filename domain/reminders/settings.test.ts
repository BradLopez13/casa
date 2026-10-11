import { describe, expect, it } from 'vitest';
import { DEFAULT_REMINDER_SETTINGS, parseReminderSettings } from './settings';

describe('parseReminderSettings', () => {
  it('falls back to the defaults for missing or non-object input', () => {
    expect(parseReminderSettings(undefined)).toEqual(DEFAULT_REMINDER_SETTINGS);
    expect(parseReminderSettings('basura')).toEqual(DEFAULT_REMINDER_SETTINGS);
    expect(parseReminderSettings(null)).toEqual(DEFAULT_REMINDER_SETTINGS);
  });

  it('defaults are off, 09:00 and 20:00', () => {
    expect(DEFAULT_REMINDER_SETTINGS).toEqual({
      enabled: false,
      morning: '09:00',
      evening: '20:00',
    });
  });

  it('replaces only the invalid fields', () => {
    expect(parseReminderSettings({ enabled: 'sí' })).toEqual(DEFAULT_REMINDER_SETTINGS);
    expect(parseReminderSettings({ morning: '25:00' })).toEqual(DEFAULT_REMINDER_SETTINGS);
    expect(parseReminderSettings({ enabled: true, morning: '7:5', evening: '21:30' })).toEqual({
      enabled: true,
      morning: '09:00',
      evening: '21:30',
    });
  });

  it('keeps a fully valid value', () => {
    const valid = { enabled: true, morning: '07:15', evening: '23:59' };
    expect(parseReminderSettings(valid)).toEqual(valid);
  });
});
