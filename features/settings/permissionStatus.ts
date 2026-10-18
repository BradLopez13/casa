import type { NotificationPermission } from '@/features/reminders/plan';

/** What Ajustes needs to know about the phone's notification permission. */
export type PermissionStatus = 'granted' | 'denied' | 'unknown';

/** Not read yet, or never asked: neither says the phone has turned notifications off. */
export function permissionStatus(permission: NotificationPermission | null): PermissionStatus {
  if (permission === 'granted' || permission === 'denied') return permission;
  return 'unknown';
}
