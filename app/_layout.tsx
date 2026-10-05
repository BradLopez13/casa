import { MPLUSRounded1c_800ExtraBold } from '@expo-google-fonts/m-plus-rounded-1c/800ExtraBold';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { toAppError } from '@/data/supabase/errors';
import { signOut } from '@/features/auth/api';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { Screen } from '@/ui/components/Screen';
import { useTheme } from '@/ui/theme';
import { displayFont } from '@/ui/tokens';
import { resolveRoute, type RouteInput } from '@/domain/navigation/resolve-route';
import { SessionProvider, useSession } from '@/features/auth/SessionProvider';
import { usePendingInvite } from '@/features/households/pending-invite';
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

function MembershipError({
  network,
  retrying,
  onRetry,
}: {
  network: boolean;
  retrying: boolean;
  onRetry: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.page }]}>
      <Screen>
        <Text style={{ color: colors.ink, fontSize: 18 }}>
          {network ? t('errors.membershipNetwork') : t('errors.membershipLoad')}
        </Text>
        <Button
          testID="membership.retry"
          title={t('errors.retry')}
          loading={retrying}
          onPress={onRetry}
        />
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

function Guard({ fontsReady }: { fontsReady: boolean }) {
  const router = useRouter();
  const segments = useSegments();
  const session = useSession();
  const membershipQuery = useMembership();
  const pending = usePendingInvite();

  const signedIn = session.status === 'signed-in';
  const hasData = membershipQuery.data !== undefined;
  const failed = signedIn && membershipQuery.isError && !hasData;
  const membership: RouteInput['membership'] =
    !signedIn || membershipQuery.isPending || pending.isLoading || failed
      ? 'loading'
      : membershipQuery.data === null
        ? 'none'
        : 'member';
  const group = groupOf(segments[0]);
  const target = resolveRoute({
    session: session.status,
    membership,
    hasPendingInvite: pending.hasPendingInvite,
    group,
  });

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  const ready =
    fontsReady &&
    !pending.isLoading &&
    session.status !== 'loading' &&
    !(signedIn && membershipQuery.isPending) &&
    target === null;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      {failed ? (
        <MembershipError
          network={toAppError(membershipQuery.error).code === 'NETWORK'}
          retrying={membershipQuery.isFetching}
          onRetry={() => void membershipQuery.refetch()}
        />
      ) : null}
    </>
  );
}

export default function RootLayout() {
  // A font that fails to load falls back to the system face; it must not keep the splash up.
  const [fontsLoaded, fontError] = useFonts({ [displayFont]: MPLUSRounded1c_800ExtraBold });
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <Guard fontsReady={fontsLoaded || fontError !== null} />
      </SessionProvider>
    </QueryClientProvider>
  );
}
