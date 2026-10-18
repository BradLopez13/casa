import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { getPermission } from '@/features/reminders/notifications';
import type { NotificationPermission } from '@/features/reminders/plan';
import { permissionStatus, type PermissionStatus } from './permissionStatus';

// One reading for the whole screen: the notice and the two sections that ask for the
// permission see the same answer, so an answer given in one section reaches the notice too.
let current: NotificationPermission | null = null;
const listeners = new Set<() => void>();

function publish(next: NotificationPermission) {
  if (next === current) return;
  current = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = () => current;

function check() {
  getPermission()
    .then(publish)
    .catch(() => undefined);
}

/**
 * The phone's notification permission (null until it is read), read again each time the app
 * comes back, and a way to record the answer to a request.
 */
export function usePhonePermission(): [
  NotificationPermission | null,
  (permission: NotificationPermission) => void,
] {
  const permission = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => subscription.remove();
  }, []);
  return [permission, publish];
}

/** Whether the phone lets the app notify: the one question the Ajustes notice answers. */
export function useNotificationPermission(): PermissionStatus {
  return permissionStatus(usePhonePermission()[0]);
}
