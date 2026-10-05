import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
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
import { locale, t, type MessageKey } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { ErrorText } from '@/ui/components/ErrorText';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { Screen } from '@/ui/components/Screen';
import { ScreenTitle } from '@/ui/components/ScreenTitle';
import { useTheme } from '@/ui/theme';

type Pending = { kind: 'remove' | 'transfer' | 'leave' | 'delete'; userId?: string };

const ERROR_KEYS: Partial<Record<string, MessageKey>> = {
  NOT_AUTHENTICATED: 'members.errors.NOT_AUTHENTICATED',
  OWNER_MUST_TRANSFER: 'members.errors.OWNER_MUST_TRANSFER',
  NOT_OWNER: 'members.errors.NOT_OWNER',
  NOT_A_MEMBER: 'members.errors.NOT_A_MEMBER',
  INVITE_INVALID: 'members.errors.INVITE_INVALID',
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

// selfDirected: the action is about the current user (invite, leave, delete...), so a
// NOT_A_MEMBER means "you are no longer in this household", not "that person left".
function errorText(e: unknown, selfDirected = false): string {
  const code = toAppError(e).code;
  if (selfDirected && code === 'NOT_A_MEMBER') return t('members.errors.SELF_NOT_A_MEMBER');
  return t(ERROR_KEYS[code] ?? 'members.errors.UNKNOWN');
}

function formatExpiry(expiresAt: string): string {
  return new Date(expiresAt).toLocaleDateString(locale, { day: 'numeric', month: 'long' });
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
  const [copied, setCopied] = useState(false);
  const [action, setAction] = useState<'share' | 'copy' | null>(null);
  const [footerError, setFooterError] = useState<string | undefined>();
  // Synchronous guards: a second tap can land before the pending state re-renders.
  const inviteBusy = useRef(false);
  const confirming = useRef(false);
  // The confirmation fades after a few seconds; the timer is cleared on unmount or reset.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 3000);
    return () => clearTimeout(timer);
  }, [copied]);
  const onlyMember = isOwner && members.data?.length === 1;
  const mustTransfer = isOwner && (members.data?.length ?? 0) > 1;

  async function onInvite() {
    if (!householdId || inviteBusy.current) return;
    inviteBusy.current = true;
    setAction('share');
    setCopied(false);
    setError(undefined);
    try {
      const { token } = await invite.mutateAsync(householdId);
      const url = buildInviteUrl(token, Linking.createURL);
      // Dismissing the share sheet is not an error; Share.share resolves either way.
      await Share.share({ message: t('invite.shareMessage', { url }) });
    } catch (e) {
      setError(errorText(e, true));
    } finally {
      inviteBusy.current = false;
      setAction(null);
    }
  }

  async function onCopyLink() {
    if (!householdId || inviteBusy.current) return;
    inviteBusy.current = true;
    setAction('copy');
    setError(undefined);
    setCopied(false);
    try {
      const { token } = await invite.mutateAsync(householdId);
      await Clipboard.setStringAsync(buildInviteUrl(token, Linking.createURL));
      setCopied(true);
    } catch (e) {
      setError(errorText(e, true));
    } finally {
      inviteBusy.current = false;
      setAction(null);
    }
  }

  function onLeave() {
    setFooterError(undefined);
    // The DB would refuse (OWNER_MUST_TRANSFER); say so next to the button instead of a dialog.
    if (mustTransfer) {
      setFooterError(t('members.errors.OWNER_MUST_TRANSFER'));
      return;
    }
    setPending({ kind: 'leave' });
  }

  function onRevoke(inviteId: string) {
    setCopied(false);
    setError(undefined);
    revoke.mutate(inviteId, { onError: (e) => setError(errorText(e, true)) });
  }

  const target = pending?.userId
    ? members.data?.find((m) => m.userId === pending.userId)
    : undefined;
  const targetName = target?.displayName ?? '';
  const busy = remove.isPending || transfer.isPending || leave.isPending || del.isPending;

  function confirm() {
    if (!pending || !householdId || confirming.current) return;
    confirming.current = true;
    const footer = pending.kind === 'leave' || pending.kind === 'delete';
    const done = {
      onSuccess: () => setPending(null),
      onError: (e: unknown) => {
        setPending(null);
        (footer ? setFooterError : setError)(errorText(e, footer));
      },
      onSettled: () => {
        confirming.current = false;
      },
    };
    setError(undefined);
    setFooterError(undefined);
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
    <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 20, fontWeight: '700' }}>
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
      <ScreenTitle>{t('members.title')}</ScreenTitle>

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
        loading={action === 'share'}
        onPress={() => void onInvite()}
      />
      <Button
        testID="members.copy-link"
        title={t('members.copyLink')}
        variant="secondary"
        loading={action === 'copy'}
        onPress={() => void onCopyLink()}
      />
      {copied ? (
        <Text testID="members.copied" style={{ color: colors.muted, fontSize: 14 }}>
          {t('members.copied')}
        </Text>
      ) : null}
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
              <Text style={{ color: colors.ink, fontSize: 16 }}>
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
        onPress={onLeave}
      />
      {isOwner ? (
        <Button
          testID="members.delete-household"
          title={t('members.deleteHousehold')}
          variant="danger"
          onPress={() => {
            setFooterError(undefined);
            setPending({ kind: 'delete' });
          }}
        />
      ) : null}
      {footerError ? <ErrorText testID="members.footer-error">{footerError}</ErrorText> : null}

      <ConfirmDialog
        visible={pending !== null}
        title={dialog ? t(dialog.title, { name: targetName }) : ''}
        message={
          dialog
            ? t(
                pending?.kind === 'leave' && onlyMember
                  ? 'members.confirm.leaveLastMessage'
                  : dialog.message,
              )
            : ''
        }
        confirmLabel={dialog ? t(dialog.action) : ''}
        destructive={pending?.kind !== 'transfer'}
        loading={busy}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </Screen>
  );
}
