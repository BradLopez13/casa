import { getCalendars } from 'expo-localization';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { shouldSyncTimeZone } from '@/domain/time-zone/sync';
import { fetchOwnTimeZone, setTimeZone } from './time-zone';

/**
 * Keeps the profile's time zone equal to the phone's: on mount and each time the app returns
 * to the foreground. Errors are ignored (the next foreground retries); only one sync runs at
 * a time.
 */
export function useSyncTimeZone(userId: string | null): void {
  const inFlight = useRef(false);
  useEffect(() => {
    if (!userId) return;
    const sync = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const deviceTz = getCalendars()[0]?.timeZone;
        const profileTz = await fetchOwnTimeZone(userId);
        if (deviceTz && shouldSyncTimeZone(profileTz, deviceTz)) await setTimeZone(deviceTz);
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
