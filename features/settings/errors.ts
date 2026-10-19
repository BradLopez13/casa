import { toAppError } from '@/data/supabase/errors';
import { t } from '@/i18n';

/** A settings change that failed: the display name or the household notices. */
export function settingsErrorMessage(error: unknown): string {
  const code = toAppError(error).code;
  if (code === 'INVALID_DISPLAY_NAME') return t('errors.INVALID_DISPLAY_NAME');
  return t(code === 'NETWORK' ? 'members.errors.NETWORK' : 'members.errors.UNKNOWN');
}
