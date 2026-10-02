import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Share, Text, View } from 'react-native';
import { useSession } from '@/features/auth/SessionProvider';
import {
  createInvite,
  deleteHousehold,
  leaveHousehold,
  removeMember,
  revokeInvite,
  transferOwnership,
} from '@/features/households/api';
import { buildInviteUrl } from '@/features/households/invite-link';
import { MemberRow } from '@/features/households/MemberRow';
import {
  useHouseholdMutation,
  useInvites,
  useMembers,
  useMembership,
} from '@/features/households/queries';
import { toAppError } from '@/data/supabase/errors';
import { t, type MessageKey } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { ErrorText } from '@/ui/components/ErrorText';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { Screen } from '@/ui/components/Screen';
import { useTheme } from '@/ui/theme';

type Pending = { kind: 'remove' | 'transfer' | 'leave' | 'delete'; userId?: string };

const ERROR_KEYS: Partial<Record<string, MessageKey>> = {
  NOT_AUTHENTICATED: 'members.errors.NOT_AUTHENTICATED',
  OWNER_MUST_TRANSFER: 'members.errors.OWNER_MUST_TRANSFER',
  NOT_OWNER: 'members.errors.NOT_OWNER',
  NOT_A_MEMBER: 'members.errors.NOT_A_MEMBER',
  CANNOT_REMOVE_SELF: 'members.errors.CANNOT_REMOVE_SELF',
  NETWORK: 'members.errors.NETWORK',
};

const DIALOGS: Record<
  Pending['kind'],
  { title: MessageKey; message: MessageKey; action: MessageKey }
> = {
  remove: {
    title: 'members.confirm.removeTitle',
    message: 'members.confirm.removeMessage',
    action: 'members.confirm.removeAction',
  },
  transfer: {
    title: 'members.confirm.transferTitle',
    message: 'members.confirm.transferMessage',
    action: 'members.confirm.transferAction',
  },
  leave: {
    title: 'members.confirm.leaveTitle',
    message: 'members.confirm.leaveMessage',
    action: 'members.confirm.leaveAction',
  },
  delete: {
    title: 'members.confirm.deleteTitle',
    message: 'members.confirm.deleteMessage',
    action: 'members.confirm.deleteAction',
  },
};

function errorText(e: unknown): string {
  return t(ERROR_KEYS[toAppError(e).code] ?? 'members.errors.UNKNOWN');
}

function formatExpiry(expiresAt: string): string {
  return new Date(expiresAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
}

export default function MembersScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { userId } = useSession();
  const membership = useMembership().data;
  const householdId = membership?.householdId;
  const isOwner = membership?.role === 'owner';
  const members = useMembers(householdId);
  const invites = useInvites(householdId);
  const invite = useHouseholdMutation(createInvite);
  const revoke = useHouseholdMutation(revokeInvite);
  const remove = useHouseholdMutation((id: string) => removeMember(householdId as string, id));
  const transfer = useHouseholdMutation((id: string) =>
    transferOwnership(householdId as string, id),
  );
  const leave = useHouseholdMutation(leaveHousehold);
  const del = useHouseholdMutation(deleteHousehold);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | undefined>();

  async function onInvite() {
    if (!householdId) return;
    setError(undefined);
    try {
      const { token } = await invite.mutateAsync(householdId);
      const url = buildInviteUrl(token, Linking.createURL);
      // Dismissing the share sheet is not an error; Share.share resolves either way.
      await Share.share({ message: t('invite.shareMessage', { url }) });
    } catch (e) {
      setError(errorText(e));
    }
  }

  function onRevoke(inviteId: string) {
    setError(undefined);
    revoke.mutate(inviteId, { onError: (e) => setError(errorText(e)) });
  }

  const target = pending?.userId
    ? members.data?.find((m) => m.userId === pending.userId)
    : undefined;
  const targetName = target?.displayName ?? '';
  const busy = remove.isPending || transfer.isPending || leave.isPending || del.isPending;

  function confirm() {
    if (!pending || !householdId) return;
    const done = {
      onSuccess: () => setPending(null),
      onError: (e: unknown) => {
        setPending(null);
        setError(errorText(e));
      },
    };
    setError(undefined);
    // After leave/delete the membership refetch makes the route guard send the user to onboarding.
    switch (pending.kind) {
      case 'remove':
        if (pending.userId) remove.mutate(pending.userId, done);
        break;
      case 'transfer':
        if (pending.userId) transfer.mutate(pending.userId, done);
        break;
      case 'leave':
        leave.mutate(householdId, done);
        break;
      case 'delete':
        del.mutate(householdId, done);
        break;
    }
  }

  const dialog = pending ? DIALOGS[pending.kind] : null;

  const heading = (key: MessageKey) => (
    <Text
      accessibilityRole="header"
      style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}
    >
      {t(key)}
    </Text>
  );

  return (
    <Screen>
      <Button
        testID="members.back"
        title={t('members.back')}
        variant="secondary"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
      />
      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 28, fontWeight: '700' }}
      >
        {t('members.title')}
      </Text>

      {members.isError ? (
        <>
          <ErrorText testID="members.load-error">{t('members.loadError')}</ErrorText>
          <Button
            testID="members.retry"
            title={t('errors.retry')}
            loading={members.isFetching}
            onPress={() => void members.refetch()}
          />
        </>
      ) : members.data ? (
        <View style={{ gap: 12 }}>
          {members.data.map((m) => (
            <MemberRow
              key={m.userId}
              member={m}
              isSelf={m.userId === userId}
              canManage={isOwner}
              onMakeOwner={() => setPending({ kind: 'transfer', userId: m.userId })}
              onRemove={() => setPending({ kind: 'remove', userId: m.userId })}
            />
          ))}
        </View>
      ) : (
        <Text style={{ color: colors.muted }}>{t('members.loading')}</Text>
      )}

      <Button
        testID="members.invite"
        title={t('members.invite')}
        loading={invite.isPending}
        onPress={() => void onInvite()}
      />
      {error ? <ErrorText testID="members.error">{error}</ErrorText> : null}

      {heading('members.pendingTitle')}
      {invites.isError ? (
        <>
          <ErrorText testID="members.invites-error">{t('members.invitesLoadError')}</ErrorText>
          <Button
            testID="members.invites-retry"
            title={t('errors.retry')}
            loading={invites.isFetching}
            onPress={() => void invites.refetch()}
          />
        </>
      ) : invites.data ? (
        invites.data.length === 0 ? (
          <Text style={{ color: colors.muted }}>{t('members.pendingEmpty')}</Text>
        ) : (
          invites.data.map((inv) => (
            <View key={inv.id} testID={`members.invite-row.${inv.id}`} style={{ gap: 8 }}>
              <Text style={{ color: colors.text, fontSize: 16 }}>
                {t('members.expires', { date: formatExpiry(inv.expiresAt) })}
              </Text>
              {isOwner || inv.createdBy === userId ? (
                <Button
                  testID={`members.revoke.${inv.id}`}
                  title={t('members.revoke')}
                  variant="secondary"
                  loading={revoke.isPending && revoke.variables === inv.id}
                  onPress={() => onRevoke(inv.id)}
                />
              ) : null}
            </View>
          ))
        )
      ) : (
        <Text style={{ color: colors.muted }}>{t('members.loading')}</Text>
      )}
      <Button
        testID="members.leave"
        title={t('members.leave')}
        variant="secondary"
        onPress={() => setPending({ kind: 'leave' })}
      />
      {isOwner ? (
        <Button
          testID="members.delete-household"
          title={t('members.deleteHousehold')}
          variant="danger"
          onPress={() => setPending({ kind: 'delete' })}
        />
      ) : null}

      <ConfirmDialog
        visible={pending !== null}
        title={dialog ? t(dialog.title, { name: targetName }) : ''}
        message={dialog ? t(dialog.message) : ''}
        confirmLabel={dialog ? t(dialog.action) : ''}
        destructive={pending?.kind !== 'transfer'}
        loading={busy}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </Screen>
  );
}
