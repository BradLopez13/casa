import Constants from 'expo-constants';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import {
  ensureHouseholdChannel,
  getExpoPushToken,
  getPermission,
} from '@/features/reminders/notifications';
import { registerPushToken } from './api';
import { loadPushRegistration, savePushRegistration, shouldRegister } from './registration';

/** Read at call time: undefined until the EAS project is configured. */
function easProjectId(): string | null {
  const extra: unknown = Constants.expoConfig?.extra;
  if (typeof extra !== 'object' || extra === null) return null;
  const eas: unknown = (extra as { eas?: unknown }).eas;
  if (typeof eas !== 'object' || eas === null) return null;
  const id: unknown = (eas as { projectId?: unknown }).projectId;
  return typeof id === 'string' && id !== '' ? id : null;
}

/**
 * Registers this phone's push token for the signed-in user, on mount and each time the app
 * returns to the foreground. Never asks for the permission: with it not granted, or with no
 * EAS project configured, it does nothing. Errors are ignored (the next foreground retries);
 * only one run at a time.
 */
export function usePushRegistration(userId: string | null): void {
  const inFlight = useRef(false);
  useEffect(() => {
    if (!userId) return;
    const platform = Platform.OS;
    if (platform !== 'android' && platform !== 'ios') return;
    // Set on sign-out (or user change): a run still in flight must not save its result, so the
    // next sign-in registers again instead of trusting a token that may have been unregistered.
    let stale = false;
    const run = async () => {
      if (inFlight.current) return;
      const projectId = easProjectId();
      if (!projectId) return;
      inFlight.current = true;
      try {
        if ((await getPermission()) !== 'granted') return;
        await ensureHouseholdChannel();
        const token = await getExpoPushToken(projectId);
        const current = { userId, token };
        if (!shouldRegister(await loadPushRegistration(), current)) return;
        await registerPushToken(token, platform);
        if (!stale) await savePushRegistration(current);
      } catch {
        // Silent by design: retried on the next foreground.
      } finally {
        inFlight.current = false;
      }
    };
    void run();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void run();
    });
    return () => {
      stale = true;
      subscription.remove();
    };
  }, [userId]);
}
