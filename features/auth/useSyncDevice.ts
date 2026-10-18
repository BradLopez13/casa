import { getCalendars } from 'expo-localization';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { shouldSyncTimeZone } from '@/domain/time-zone/sync';
import { setLocale } from '@/features/households/api';
import { lang } from '@/i18n';
import { fetchOwnTimeZone, setTimeZone } from './time-zone';

/**
 * Keeps the profile's time zone and language equal to the phone's: on mount and each time the
 * app returns to the foreground. The language is sent once per signed-in person and session
 * (the last value sent is remembered). Errors are ignored (the next foreground retries); only
 * one sync runs at a time.
 */
export function useSyncDevice(userId: string | null): void {
  const inFlight = useRef(false);
  const sentLocale = useRef<{ userId: string; locale: string } | null>(null);
  useEffect(() => {
    if (!userId) return;
    const sync = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const deviceTz = getCalendars()[0]?.timeZone;
        const profileTz = await fetchOwnTimeZone(userId);
        if (deviceTz && shouldSyncTimeZone(profileTz, deviceTz)) await setTimeZone(deviceTz);
        const sent = sentLocale.current;
        if (sent?.userId !== userId || sent.locale !== lang) {
          await setLocale(lang);
          sentLocale.current = { userId, locale: lang };
        }
      } catch {
        // Silent by design: retried on the next foreground.
      } finally {
        inFlight.current = false;
      }
    };
    void sync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });
    return () => subscription.remove();
  }, [userId]);
}
