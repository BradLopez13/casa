import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { toAppError } from '@/data/supabase/errors';
import { signOut } from '@/features/auth/api';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { Screen } from '@/ui/components/Screen';
import { useTheme } from '@/ui/theme';
import { resolveRoute, type RouteInput } from '@/domain/navigation/resolve-route';
import { SessionProvider, useSession } from '@/features/auth/SessionProvider';
import { useMembership } from '@/features/households/queries';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

// Refetch stale queries when the app returns to the foreground.
if (Platform.OS !== 'web') {
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (state) => {
      handleFocus(state === 'active');
    });
    return () => subscription.remove();
  });
}

function MembershipError({ network, onRetry }: { network: boolean; onRetry: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]}>
      <Screen>
        <Text style={{ color: colors.text, fontSize: 18 }}>
          {network ? t('errors.membershipNetwork') : t('errors.membershipLoad')}
        </Text>
        <Button testID="membership.retry" title={t('errors.retry')} onPress={onRetry} />
        <Button
          testID="membership.sign-out"
          title={t('auth.signOut')}
          variant="secondary"
          onPress={() => void signOut().catch(() => undefined)}
        />
      </Screen>
    </View>
  );
}

function groupOf(segment: string | undefined): RouteInput['group'] {
  switch (segment) {
    case undefined:
    case 'index':
      return 'root';
    case '(auth)':
      return 'auth';
    case 'onboarding':
      return 'onboarding';
    case 'invite':
      return 'invite';
    default:
      return 'app';
  }
}

function Guard() {
  const router = useRouter();
  const segments = useSegments();
  const session = useSession();
  const membershipQuery = useMembership();

  const signedIn = session.status === 'signed-in';
  const hasData = membershipQuery.data !== undefined;
  const failed = signedIn && membershipQuery.isError && !hasData;
  const membership: RouteInput['membership'] =
    !signedIn || membershipQuery.isPending || failed
      ? 'loading'
      : membershipQuery.data === null
        ? 'none'
        : 'member';
  const group = groupOf(segments[0]);
  const target = resolveRoute({
    session: session.status,
    membership,
    hasPendingInvite: false, // Task 8
    group,
  });

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  const ready =
    session.status !== 'loading' && !(signedIn && membershipQuery.isPending) && target === null;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      {failed ? (
        <MembershipError
          network={toAppError(membershipQuery.error).code === 'NETWORK'}
          onRetry={() => void membershipQuery.refetch()}
        />
      ) : null}
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <Guard />
      </SessionProvider>
    </QueryClientProvider>
  );
}
