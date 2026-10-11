import type { NotificationPermission } from '@/features/reminders/plan';

export type PermissionView = 'none' | 'enable' | 'denied';

/**
 * What the notices section shows about the phone's permission. Unknown (still reading) and
 * granted show nothing; undetermined offers the button; denied explains and links to the
 * system settings, because asking again would do nothing.
 */
export function permissionView(permission: NotificationPermission | null): PermissionView {
  if (permission === 'undetermined') return 'enable';
  if (permission === 'denied') return 'denied';
  return 'none';
}
