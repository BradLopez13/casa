import { locale, t } from '@/i18n';

/** "Caduca el 23 de octubre" for an invite's expiry (a date or a timestamp). */
export function inviteExpiresText(expiresAt: string): string {
  // A bare date is read as a local day, not UTC midnight, so it never slips to the day before.
  const when = new Date(expiresAt.length === 10 ? `${expiresAt}T12:00:00` : expiresAt);
  const date = when.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
  return t('members.inviteExpires', { date });
}
