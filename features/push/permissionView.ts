import type { NotificationPermission } from '@/features/reminders/plan';

export type PermissionView = 'none' | 'enable';

/**
 * What the notices section shows about the phone's permission. Unknown (still reading) and
 * granted show nothing; undetermined offers the button. Denied shows nothing here: the
 * NotificationsOffBand explains it and links to the system settings.
 */
export function permissionView(permission: NotificationPermission | null): PermissionView {
  if (permission === 'undetermined') return 'enable';
  return 'none';
}
