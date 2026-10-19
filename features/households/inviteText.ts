import { locale, t } from '@/i18n';

/** "Caduca el 23 de octubre" for an invite's expiry (a date or a timestamp). */
export function inviteExpiresText(expiresAt: string): string {
  // A bare date is read as a local day, not UTC midnight, so it never slips to the day before.
  const when = new Date(expiresAt.length === 10 ? `${expiresAt}T12:00:00` : expiresAt);
  const date = when.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
  return t('members.inviteExpires', { date });
}

export type InvitePreview = {
  householdName: string;
  inviterName: string | null;
  memberCount: number;
};

/** The invite screen's title and the line under it; without a preview, the plain title. */
export function invitePreviewText(preview: InvitePreview | null): {
  title: string;
  from: string | null;
} {
  if (!preview) return { title: t('invite.title'), from: null };
  const count = preview.memberCount;
  const members = count === 1 ? t('invite.membersOne') : t('invite.membersOther', { count });
  return {
    title: t('invite.titleNamed', { household: preview.householdName }),
    from: preview.inviterName ? t('invite.from', { name: preview.inviterName, members }) : members,
  };
}
