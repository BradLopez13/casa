import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { toAppError, type AppErrorCode } from '@/data/supabase/errors';
import { AccountMenu } from '@/features/auth/AccountMenu';
import { signOut } from '@/features/auth/api';
import { useSession } from '@/features/auth/SessionProvider';
import { acceptInvite, getMyMembership } from '@/features/households/api';
import { parseInviteToken } from '@/features/households/invite-link';
import {
  useClearPendingInvite,
  usePendingInvite,
  useSetPendingInvite,
} from '@/features/households/pending-invite';
import { invitePreviewText } from '@/features/households/inviteText';
import { membershipKey, useInvitePreview } from '@/features/households/queries';
import { inviteErrorKey } from '@/features/households/errors';
import { t } from '@/i18n';
import { actionIcons } from '@/ui/actionIcons';
import { BrandHeader } from '@/ui/components/BrandHeader';
import { Button } from '@/ui/components/Button';
import { ErrorText } from '@/ui/components/ErrorText';
import { CenteredCard } from '@/ui/components/CenteredCard';
import { ScreenTitle } from '@/ui/components/ScreenTitle';
import { useTheme } from '@/ui/theme';

const TERMINAL: ReadonlySet<AppErrorCode> = new Set([
  'INVITE_INVALID',
  'INVITE_EXPIRED',
  'ALREADY_IN_HOUSEHOLD',
]);

export default function InviteScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSession();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const pending = usePendingInvite();
  const setPending = useSetPendingInvite();
  const clearPending = useClearPendingInvite();
  const [accepting, setAccepting] = useState(false);
  // 'busy': joined or leaving, waiting for the membership refresh (render blank, never an
  // error); 'failed': joined, but the membership refresh failed (retry without re-accepting).
  const [phase, setPhase] = useState<'busy' | 'failed' | null>(null);
  const [refreshNetwork, setRefreshNetwork] = useState(false);
  const [failure, setFailure] = useState<{ code: AppErrorCode; terminal: boolean } | null>(null);

  // A present-but-malformed token param is invalid; only fall back to the stored token
  // when the param is absent.
  const paramToken = parseInviteToken(params.token);
  const hasParam = params.token !== undefined && params.token !== '';
  const token = hasParam ? paramToken : pending.token;
  const [persistFailed, setPersistFailed] = useState(false);
  const signedOut = session.status === 'signed-out';
  const stored = useRef(false);
  // Before accepting: which household, who invites and how many live there.
  const preview = useInvitePreview(session.status === 'signed-in' ? token : null);
  const previewCode = preview.error ? toAppError(preview.error).code : null;
  const previewDead = previewCode !== null && TERMINAL.has(previewCode);

  // A dead invite is forgotten, so the guard does not bring the user back to it.
  useEffect(() => {
    if (previewDead) clearPending.mutate();
    // clearPending is a new object each render; only the outcome matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewDead]);

  // Signed out: remember the invite, then sign in; the guard brings the user back here.
  useEffect(() => {
    if (!signedOut || stored.current) return;
    stored.current = true;
    // A malformed link is shown as invalid below: don't store anything or redirect.
    if (hasParam && !paramToken) return;
    if (token) {
      setPending.mutate(token, {
        onSuccess: () => router.replace('/sign-in'),
        onError: () => setPersistFailed(true),
      });
    } else {
      router.replace('/sign-in');
    }
  }, [signedOut, token, hasParam, paramToken, setPending, router]);

  async function accept() {
    if (!token) return;
    setAccepting(true);
    try {
      await acceptInvite(token);
      // Accepted: from here on nothing may turn this into an error. Clear the stored token
      // first (best effort) so the guard's pending-invite rule does not bring us back here.
      setPhase('busy');
      await clearPending.mutateAsync().catch(() => undefined);
      await refreshMembershipAndLeave();
    } catch (e) {
      const code = toAppError(e).code;
      const terminal = TERMINAL.has(code);
      // A terminal error can mean we are already in: a lost response followed by a retry,
      // or a stale membership. Check fresh before showing anything.
      // ALREADY_IN_HOUSEHOLD is the exception: the user must be told the invite was not used.
      if (terminal && code !== 'ALREADY_IN_HOUSEHOLD' && (await leaveIfMember())) return;
      setFailure({ code, terminal });
      if (terminal) await clearPending.mutateAsync().catch(() => undefined);
      // Refresh membership (best effort) so Continue lands on /today.
      if (code === 'ALREADY_IN_HOUSEHOLD') {
        await queryClient
          .fetchQuery({ queryKey: membershipKey, queryFn: getMyMembership, staleTime: 0 })
          .catch(() => undefined);
      }
    } finally {
      setAccepting(false);
    }
  }

  /** Fetches membership fresh; if the user is a member, clears pending and goes to root. */
  async function leaveIfMember(): Promise<boolean> {
    try {
      const membership = await queryClient.fetchQuery({
        queryKey: membershipKey,
        queryFn: getMyMembership,
        staleTime: 0,
      });
      if (!membership) return false;
    } catch {
      return false;
    }
    setPhase('busy');
    await clearPending.mutateAsync().catch(() => undefined);
    router.replace('/');
    return true;
  }

  async function onContinue() {
    if (await leaveIfMember()) return;
    router.replace('/');
  }

  async function onSignOut() {
    // The stored token belongs to this account's session: don't hand it to the next one.
    await clearPending.mutateAsync().catch(() => undefined);
    await signOut().catch(() => undefined);
  }

  async function refreshMembershipAndLeave() {
    setPhase('busy');
    try {
      // Fetch (not just invalidate) so a failure is visible here instead of the guard
      // acting on the stale "no household" data.
      await queryClient.fetchQuery({
        queryKey: membershipKey,
        queryFn: getMyMembership,
        staleTime: 0,
      });
    } catch (e) {
      setRefreshNetwork(toAppError(e).code === 'NETWORK');
      setPhase('failed');
      return;
    }
    // Root lets the guard pick /today (it returns null for member + invite by design).
    router.replace('/');
  }

  async function dismiss() {
    setPhase('busy');
    await clearPending.mutateAsync().catch(() => undefined);
    router.replace('/');
  }

  if (signedOut && hasParam && !paramToken) {
    return (
      <CenteredCard header={<BrandHeader />}>
        <ErrorText testID="invite.error">{t('invite.errors.INVITE_INVALID')}</ErrorText>
        <Button
          testID="invite.back"
          title={t('invite.back')}
          variant="tertiary"
          icon={actionIcons.back}
          width="hug"
          onPress={() => router.replace('/sign-in')}
        />
      </CenteredCard>
    );
  }

  if (signedOut && persistFailed) {
    return (
      <CenteredCard header={<BrandHeader />}>
        <ErrorText testID="invite.error">{t('invite.errors.UNKNOWN')}</ErrorText>
        <Button
          testID="invite.back"
          title={t('invite.back')}
          variant="tertiary"
          icon={actionIcons.back}
          width="hug"
          onPress={() => router.replace('/sign-in')}
        />
      </CenteredCard>
    );
  }

  if (session.status !== 'signed-in' || pending.isLoading || phase === 'busy') return null;

  // Signed in: signing out (or deleting the account) waits behind «⋯» on the band.
  const band = <BrandHeader trailing={<AccountMenu onSignOut={() => void onSignOut()} />} />;

  if (phase === 'failed') {
    return (
      <CenteredCard header={band}>
        <ErrorText testID="invite.error">
          {refreshNetwork ? t('errors.membershipNetwork') : t('errors.membershipLoad')}
        </ErrorText>
        <Button
          testID="invite.retry"
          title={t('errors.retry')}
          variant="outlined"
          icon={actionIcons.retry}
          width="hug"
          onPress={() => void refreshMembershipAndLeave()}
        />
      </CenteredCard>
    );
  }

  // Without a preview (still loading, offline, or a dead invite) the plain title stays.
  const text = invitePreviewText(preview.data ?? null);
  const title = <ScreenTitle subtitle={text.from ?? undefined}>{text.title}</ScreenTitle>;
  const dead = failure?.terminal ? failure.code : previewDead ? previewCode : null;

  if (dead) {
    return (
      <CenteredCard header={band}>
        {title}
        <ErrorText testID="invite.error">{t(inviteErrorKey(dead))}</ErrorText>
        <Button
          testID="invite.continue"
          title={t('invite.continue')}
          icon={actionIcons.confirm}
          width="full"
          onPress={() => void onContinue()}
        />
      </CenteredCard>
    );
  }

  if (!token) {
    return (
      <CenteredCard header={band}>
        {title}
        <ErrorText testID="invite.error">{t('invite.errors.INVITE_INVALID')}</ErrorText>
        <Button
          testID="invite.back"
          title={t('invite.back')}
          variant="tertiary"
          icon={actionIcons.back}
          width="hug"
          onPress={() => router.replace('/')}
        />
      </CenteredCard>
    );
  }

  // A blank moment beats a title that changes under the reader's eyes.
  if (preview.isPending) return null;

  return (
    <CenteredCard header={band}>
      {title}
      <Text style={{ color: colors.ink, fontSize: 16 }}>{t('invite.body')}</Text>
      {failure ? (
        <ErrorText testID="invite.error">{t(inviteErrorKey(failure.code))}</ErrorText>
      ) : null}
      <Button
        testID="invite.accept"
        title={t('invite.accept')}
        icon={actionIcons.confirm}
        width="full"
        loading={accepting}
        onPress={() => void accept()}
      />
      <Button
        testID="invite.dismiss"
        title={t('invite.dismiss')}
        icon={actionIcons.close}
        variant="tertiary"
        width="hug"
        onPress={() => void dismiss()}
      />
    </CenteredCard>
  );
}
