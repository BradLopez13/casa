import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import { Share, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/features/auth/SessionProvider';
import {
  createInvite,
  deleteHousehold,
  leaveHousehold,
  removeMember,
  revokeInvite,
  transferOwnership,
  type Membership,
} from '@/features/households/api';
import { buildInviteUrl } from '@/features/households/invite-link';
import { MemberRow } from '@/features/households/MemberRow';
import {
  useHouseholdMutation,
  useInvites,
  useMembers,
  useMembership,
  useSeveralHouseholds,
} from '@/features/households/queries';
import { useIsOnline } from '@/data/query/online';
import { forgetHouseholdData } from '@/data/query/persist';
import { firstInitial, memberMarks, type MemberMark } from '@/domain/members/marks';
import { DIALOGS, type Pending } from '@/features/households/memberDialogs';
import { PendingInvites } from '@/features/households/PendingInvites';
import { memberErrorMessage } from '@/features/households/errors';
import { t, type MessageKey } from '@/i18n';
import { actionIcons } from '@/ui/actionIcons';
import { AccountZone } from '@/ui/components/AccountZone';
import { Button } from '@/ui/components/Button';
import { ErrorText } from '@/ui/components/ErrorText';
import { LoadError } from '@/ui/components/LoadError';
import { OfflineBand } from '@/ui/components/OfflineBand';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { useNotice } from '@/ui/components/Notice';
import { ModalHeader } from '@/ui/components/ModalHeader';
import { TwoPane } from '@/ui/components/TwoPane';
import { paneMode } from '@/ui/panes';
import { useTheme } from '@/ui/theme';
import { displayFontBold } from '@/ui/tokens';
import { useLayout } from '@/ui/useLayout';

export default function MembersScreen() {
  const { colors, space } = useTheme();
  const split = paneMode(useLayout()) === 'split';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userId } = useSession();
  const online = useIsOnline();
  const notify = useNotice();
  const membership = useMembership().data;
  const householdId = membership?.householdId;
  const isOwner = membership?.role === 'owner';
  const several = useSeveralHouseholds();
  const members = useMembers(householdId);
  const invites = useInvites(householdId);
  const invite = useHouseholdMutation(createInvite);
  const revoke = useHouseholdMutation(revokeInvite);
  const remove = useHouseholdMutation((id: string) => removeMember(householdId as string, id));
  const transfer = useHouseholdMutation((id: string) =>
    transferOwnership(householdId as string, id),
  );
  // Out of the household: its data must not stay on the device. With another household left the
  // app moves to it and says so (bloque 12); with none, the guard takes the person to onboarding.
  const goToNext = (id: string) => {
    const next = forgetHouseholdData<Membership>(queryClient, id);
    if (!next) return;
    router.replace('/today');
    notify(t('households.nowIn', { household: next.householdName }));
  };
  const leave = useHouseholdMutation(async (id: string) => {
    await leaveHousehold(id);
    goToNext(id);
  });
  const del = useHouseholdMutation(async (id: string) => {
    await deleteHousehold(id);
    goToNext(id);
  });
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
      setError(memberErrorMessage(e, true));
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
      setError(memberErrorMessage(e, true));
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
    revoke.mutate(inviteId, { onError: (e) => setError(memberErrorMessage(e, true)) });
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
        (footer ? setFooterError : setError)(memberErrorMessage(e, footer));
      },
      onSettled: () => {
        confirming.current = false;
      },
    };
    setError(undefined);
    setFooterError(undefined);
    // After leave/delete the app shows the next household, or the guard sends the user to onboarding.
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
  const marks = memberMarks(members.data ?? []);
  const markOf = (m: { userId: string; displayName: string }): MemberMark =>
    marks.get(m.userId) ?? { color: 'teal', initial: firstInitial(m.displayName) };

  // A section title sits further from what comes before it than from its own content.
  const heading = (key: MessageKey) => (
    <Text
      accessibilityRole="header"
      style={{ marginTop: space(4), color: colors.ink, fontFamily: displayFontBold, fontSize: 15 }}
    >
      {t(key)}
    </Text>
  );

  // Left pane: the people in the household.
  const people = (
    <View style={{ gap: space(4) }}>
      {members.isError && !members.data ? (
        // A failed refetch keeps the members already shown.
        <LoadError
          testID="members.load-error"
          message={t('members.loadError')}
          retrying={members.isFetching}
          onRetry={() => void members.refetch()}
        />
      ) : members.data ? (
        <View style={{ gap: space(3) }}>
          {members.data.map((m) => (
            <MemberRow
              key={m.userId}
              member={m}
              mark={markOf(m)}
              isSelf={m.userId === userId}
              canManage={isOwner}
              onMakeOwner={() => setPending({ kind: 'transfer', userId: m.userId })}
              onRemove={() => setPending({ kind: 'remove', userId: m.userId })}
            />
          ))}
        </View>
      ) : (
        <Text style={{ color: colors.muted, fontSize: 16 }}>{t('members.loading')}</Text>
      )}
    </View>
  );

  const hasInvite = (invites.data?.length ?? 0) > 0;
  const copyLink = (
    <Button
      testID="members.copy-link"
      title={t('members.copyLink')}
      variant="outlined"
      icon={actionIcons.copyLink}
      width="hug"
      loading={action === 'copy'}
      onPress={() => void onCopyLink()}
    />
  );

  // Right pane: bringing people in, and leaving. In one column it follows the people, a step
  // below them like every other item.
  const household = (
    <View style={{ gap: space(4), paddingTop: split ? 0 : space(4) }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
        <Button
          testID="members.invite"
          title={t('members.invite')}
          icon={actionIcons.invite}
          width="hug"
          loading={action === 'share'}
          onPress={() => void onInvite()}
        />
        {/* With a pending invite the link is copied from its card; without one, from here. */}
        {hasInvite ? null : copyLink}
      </View>
      {copied ? (
        <Text testID="members.copied" style={{ color: colors.muted, fontSize: 14 }}>
          {t('members.copied')}
        </Text>
      ) : null}
      {error ? <ErrorText testID="members.error">{error}</ErrorText> : null}

      {/* With none, one sentence says so; a title over it only repeated it (fase 10a). */}
      {invites.data?.length === 0 ? null : heading('members.pendingTitle')}
      <PendingInvites
        invites={invites}
        copyLink={copyLink}
        canRevoke={(createdBy) => isOwner || createdBy === userId}
        revokingId={revoke.isPending ? revoke.variables : undefined}
        onRevoke={onRevoke}
      />
      <AccountZone>
        <Button
          testID="members.leave"
          title={t('members.leave')}
          variant="tertiary"
          icon={actionIcons.signOut}
          width="hug"
          onPress={onLeave}
        />
        {isOwner ? (
          <Button
            testID="members.delete-household"
            title={t('members.deleteHousehold')}
            variant="tertiary"
            tone="destructive"
            icon={actionIcons.delete}
            width="hug"
            onPress={() => {
              setFooterError(undefined);
              setPending({ kind: 'delete' });
            }}
          />
        ) : null}
      </AccountZone>
      {footerError ? <ErrorText testID="members.footer-error">{footerError}</ErrorText> : null}
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.page }}>
      {/* The bar of every secondary screen: «Volver» and the title, in the sheets' one size. Clear
          of a side notch; the panes below keep their own gutter. */}
      <View style={{ paddingLeft: insets.left, paddingRight: insets.right }}>
        <ModalHeader
          title={t('members.title')}
          step={2}
          cancel={{
            testID: 'members.back',
            label: t('members.back'),
            onPress: () => (router.canGoBack() ? router.back() : router.replace('/today')),
          }}
        />
      </View>
      {online ? null : <OfflineBand label={t('members.offline')} testID="members.offline" />}
      {/* Outside the tabs: no rail beside it, so the panes keep clear of a side notch. */}
      <TwoPane
        besideRail={false}
        contentContainerStyle={{ paddingTop: space(5), paddingBottom: space(8) }}
        left={people}
        right={household}
      />

      <ConfirmDialog
        testID="members"
        visible={pending !== null}
        title={
          dialog === null
            ? ''
            : pending?.kind === 'delete' && several && membership
              ? // With more than one house, the irreversible says which (bloque 13, P3-10).
                t('members.confirm.deleteTitleNamed', { household: membership.householdName })
              : t(dialog.title, { name: targetName })
        }
        message={
          dialog
            ? t(
                pending?.kind === 'leave' && onlyMember
                  ? 'members.confirm.leaveLastMessage'
                  : dialog.message,
                { name: targetName },
              )
            : ''
        }
        confirmLabel={dialog ? t(dialog.action) : ''}
        destructive={pending?.kind !== 'transfer'}
        loading={busy}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </SafeAreaView>
  );
}
