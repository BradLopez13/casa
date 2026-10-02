import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { toAppError, type AppErrorCode } from '@/data/supabase/errors';
import { signOut } from '@/features/auth/api';
import { useSession } from '@/features/auth/SessionProvider';
import { acceptInvite, getMyMembership } from '@/features/households/api';
import { parseInviteToken } from '@/features/households/invite-link';
import {
  useClearPendingInvite,
  usePendingInvite,
  useSetPendingInvite,
} from '@/features/households/pending-invite';
import { membershipKey } from '@/features/households/queries';
import { t, type MessageKey } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { ErrorText } from '@/ui/components/ErrorText';
import { Screen } from '@/ui/components/Screen';
import { useTheme } from '@/ui/theme';

const TERMINAL: ReadonlySet<AppErrorCode> = new Set([
  'INVITE_INVALID',
  'INVITE_EXPIRED',
  'ALREADY_IN_HOUSEHOLD',
]);

function errorKey(code: AppErrorCode): MessageKey {
  switch (code) {
    case 'INVITE_INVALID':
      return 'invite.errors.INVITE_INVALID';
    case 'INVITE_EXPIRED':
      return 'invite.errors.INVITE_EXPIRED';
    case 'ALREADY_IN_HOUSEHOLD':
      return 'invite.errors.ALREADY_IN_HOUSEHOLD';
    case 'NETWORK':
      return 'invite.errors.NETWORK';
    default:
      return 'invite.errors.UNKNOWN';
  }
}

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
      setFailure({ code, terminal });
      if (terminal) await clearPending.mutateAsync().catch(() => undefined);
    } finally {
      setAccepting(false);
    }
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
      <Screen>
        <ErrorText testID="invite.error">{t('invite.errors.INVITE_INVALID')}</ErrorText>
        <Button
          testID="invite.back"
          title={t('invite.back')}
          onPress={() => router.replace('/sign-in')}
        />
      </Screen>
    );
  }

  if (signedOut && persistFailed) {
    return (
      <Screen>
        <ErrorText testID="invite.error">{t('invite.errors.UNKNOWN')}</ErrorText>
        <Button
          testID="invite.back"
          title={t('invite.back')}
          onPress={() => router.replace('/sign-in')}
        />
      </Screen>
    );
  }

  if (session.status !== 'signed-in' || pending.isLoading || phase === 'busy') return null;

  if (phase === 'failed') {
    return (
      <Screen>
        <ErrorText testID="invite.error">
          {refreshNetwork ? t('errors.membershipNetwork') : t('errors.membershipLoad')}
        </ErrorText>
        <Button
          testID="invite.retry"
          title={t('errors.retry')}
          onPress={() => void refreshMembershipAndLeave()}
        />
        <Button
          testID="invite.sign-out"
          title={t('auth.signOut')}
          variant="secondary"
          onPress={() => void signOut().catch(() => undefined)}
        />
      </Screen>
    );
  }

  const title = (
    <Text
      accessibilityRole="header"
      style={{ color: colors.text, fontSize: 28, fontWeight: '700' }}
    >
      {t('invite.title')}
    </Text>
  );

  if (failure?.terminal) {
    return (
      <Screen>
        {title}
        <ErrorText testID="invite.error">{t(errorKey(failure.code))}</ErrorText>
        <Button
          testID="invite.continue"
          title={t('invite.continue')}
          onPress={() => router.replace('/')}
        />
      </Screen>
    );
  }

  if (!token) {
    return (
      <Screen>
        {title}
        <ErrorText testID="invite.error">{t('invite.errors.INVITE_INVALID')}</ErrorText>
        <Button testID="invite.back" title={t('invite.back')} onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  return (
    <Screen>
      {title}
      <Text style={{ color: colors.text, fontSize: 16 }}>{t('invite.body')}</Text>
      {failure ? <ErrorText testID="invite.error">{t(errorKey(failure.code))}</ErrorText> : null}
      <Button
        testID="invite.accept"
        title={t('invite.accept')}
        loading={accepting}
        onPress={() => void accept()}
      />
      <Button
        testID="invite.dismiss"
        title={t('invite.dismiss')}
        variant="secondary"
        onPress={() => void dismiss()}
      />
      <Button
        testID="invite.sign-out"
        title={t('auth.signOut')}
        variant="secondary"
        onPress={() => void signOut().catch(() => undefined)}
      />
    </Screen>
  );
}
