import { t } from '@/i18n';
import type { NotificationPermission } from '@/features/reminders/plan';

export type SwitchState = { value: boolean; disabled: boolean; caption: string | null };

/**
 * How a notification switch looks given the phone's permission. Denied pauses it: shown off,
 * disabled, captioned. The stored preference is never touched, so it comes back when the
 * permission does.
 */
export function switchState(pref: boolean, permission: NotificationPermission): SwitchState {
  if (permission === 'denied')
    return { value: false, disabled: true, caption: t('settings.paused') };
  return { value: pref, disabled: false, caption: null };
}
