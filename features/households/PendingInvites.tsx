import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { inviteExpiresText } from '@/features/households/inviteText';
import type { useInvites } from '@/features/households/queries';
import { t } from '@/i18n';
import { actionIcons } from '@/ui/actionIcons';
import { Button } from '@/ui/components/Button';
import { ErrorText } from '@/ui/components/ErrorText';
import { useTheme } from '@/ui/theme';

type Props = {
  invites: ReturnType<typeof useInvites>;
  /** Copying the link: it goes on the first invite's card. */
  copyLink: ReactNode;
  canRevoke: (createdBy: string | null) => boolean;
  /** The invite being revoked, if any. */
  revokingId: string | undefined;
  onRevoke: (inviteId: string) => void;
};

/** The members screen's pending invites: each one a note, with its link and its revoke. */
export function PendingInvites({ invites, copyLink, canRevoke, revokingId, onRevoke }: Props) {
  const { colors, radii, shadows, noteEdge, space } = useTheme();
  return (
    <>
      {invites.isError ? (
        <>
          <ErrorText testID="members.invites-error">{t('members.invitesLoadError')}</ErrorText>
          <Button
            testID="members.invites-retry"
            title={t('errors.retry')}
            variant="secondary"
            icon={actionIcons.retry}
            width="hug"
            loading={invites.isFetching}
            onPress={() => void invites.refetch()}
          />
        </>
      ) : invites.data ? (
        invites.data.length === 0 ? (
          <Text style={{ color: colors.muted, fontSize: 16 }}>{t('members.pendingEmpty')}</Text>
        ) : (
          invites.data.map((inv, index) => (
            <View
              key={inv.id}
              testID={`members.invite-row.${inv.id}`}
              // A pending invite is a note on the page, like the member rows.
              style={{
                gap: space(3),
                padding: space(4),
                borderRadius: radii.note,
                backgroundColor: colors.note,
                ...shadows.note,
                ...noteEdge,
              }}
            >
              <Text style={{ color: colors.ink, fontSize: 16 }}>
                {inviteExpiresText(inv.expiresAt)}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
                {index === 0 ? copyLink : null}
                {canRevoke(inv.createdBy) ? (
                  <Button
                    testID={`members.revoke.${inv.id}`}
                    title={t('members.revoke')}
                    variant="tertiary"
                    icon={actionIcons.revoke}
                    width="hug"
                    loading={revokingId === inv.id}
                    onPress={() => onRevoke(inv.id)}
                  />
                ) : null}
              </View>
            </View>
          ))
        )
      ) : (
        <Text style={{ color: colors.muted, fontSize: 16 }}>{t('members.loading')}</Text>
      )}
    </>
  );
}
