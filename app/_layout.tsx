import { MPLUSRounded1c_400Regular } from '@expo-google-fonts/m-plus-rounded-1c/400Regular';
import { MPLUSRounded1c_700Bold } from '@expo-google-fonts/m-plus-rounded-1c/700Bold';
import { MPLUSRounded1c_800ExtraBold } from '@expo-google-fonts/m-plus-rounded-1c/800ExtraBold';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Stack, useNavigationContainerRef, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { cachedHouseholdIds, endedHouseholdIds } from '@/data/query/ended-household';
import { forgetEndedHousehold } from '@/data/query/persist';
import { queryClient, watchAppAndConnection } from '@/data/query/setup';
import { toAppError } from '@/data/supabase/errors';
import { signOut } from '@/features/auth/api';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { NoticeProvider, useNotice } from '@/ui/components/Notice';
import { TabBarHeightProvider } from '@/ui/tabBarHeight';
import { RootErrorBoundary } from '@/ui/components/RootErrorBoundary';
import { Screen } from '@/ui/components/Screen';
import { modalFrameFor } from '@/ui/sheet';
import { useTheme } from '@/ui/theme';
import { displayFont, displayFontBold, displayFontRegular } from '@/ui/tokens';
import { useLayout } from '@/ui/useLayout';
import { resolveRoute, type RouteInput } from '@/domain/navigation/resolve-route';
import { SessionProvider, useSession } from '@/features/auth/SessionProvider';
import { useSyncDevice } from '@/features/auth/useSyncDevice';
import { usePendingInvite } from '@/features/households/pending-invite';
import { useMembership } from '@/features/households/queries';
import { routeForNotification } from '@/features/push/routes';
import { usePushRegistration } from '@/features/push/usePushRegistration';
import { onNotificationTapped } from '@/features/reminders/notifications';
import { useReminders } from '@/features/reminders/useReminders';
import { PersistedQueries } from '@/features/offline/PersistedQueries';
import { actionIcons } from '@/ui/actionIcons';
import { configProblem } from '@/data/supabase/client';
import {
  captureError,
  initTelemetry,
  trackNavigation,
  withTelemetry,
} from '@/data/telemetry/sentry';
import { FatalScreen } from '@/ui/components/FatalScreen';

initTelemetry();

void SplashScreen.preventAutoHideAsync();

watchAppAndConnection();

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
  const notify = useNotice();
  const [signingOut, setSigningOut] = useState(false);
  const leave = () => {
    setSigningOut(true);
    signOut()
      .catch(() => notify(t('auth.signOutFailed')))
      .finally(() => setSigningOut(false));
  };
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.page }]}>
      <Screen>
        <Text style={{ color: colors.ink, fontSize: 18 }}>
          {network ? t('errors.membershipNetwork') : t('errors.membershipLoad')}
        </Text>
        <Button
          testID="membership.retry"
          title={t('errors.retry')}
          variant="outlined"
          icon={actionIcons.retry}
          loading={retrying}
          onPress={onRetry}
        />
        <Button
          testID="membership.sign-out"
          title={t('auth.signOut')}
          variant="tertiary"
          icon={actionIcons.signOut}
          loading={signingOut}
          onPress={leave}
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
    case 'auth':
      return 'auth';
    case 'onboarding':
      return 'onboarding';
    case 'invite':
      return 'invite';
    default:
      return 'app';
  }
}

/**
 * A membership that ended from someone else's side (removed, or the household deleted) must
 * not leave that household's data on the device: once the membership resolves to none or to
 * another household, the old one's is forgotten.
 */
function useForgetEndedHousehold(membership: { householdId: string } | null | undefined) {
  const client = useQueryClient();
  useEffect(() => {
    for (const id of endedHouseholdIds(cachedHouseholdIds(client), membership)) {
      forgetEndedHousehold(client, id);
    }
  }, [client, membership]);
}

/**
 * Runs `run` once the navigation container is ready: now if it already is, otherwise on the
 * first state change that finds it ready. Returns the cancel function.
 */
function whenNavReady(navRef: ReturnType<typeof useNavigationContainerRef>, run: () => void) {
  if (navRef.isReady()) {
    run();
    return () => undefined;
  }
  const unsubscribe = navRef.addListener('state', () => {
    if (!navRef.isReady()) return;
    unsubscribe();
    run();
  });
  return unsubscribe;
}

function Guard() {
  const router = useRouter();
  const modalFrame = modalFrameFor(useLayout());
  const segments = useSegments();
  // Android recreates the activity on a rotation or a font-scale change, and a redirect can then
  // fire before the navigation container is mounted: expo-router's store.assertIsReady() throws
  // "Attempted to navigate before mounting the Root Layout" unless navigationRef.isReady().
  // So navigation waits for that same signal (see `whenNavReady`).
  const navRef = useNavigationContainerRef();
  const session = useSession();
  const membershipQuery = useMembership();
  const pending = usePendingInvite();
  useForgetEndedHousehold(membershipQuery.data);
  useEffect(() => trackNavigation(navRef), [navRef]);

  const signedIn = session.status === 'signed-in';
  useSyncDevice(signedIn ? session.userId : null);
  usePushRegistration(signedIn ? session.userId : null);
  useReminders();
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
    if (!target) return;
    return whenNavReady(navRef, () => router.replace(target));
  }, [navRef, target, router]);

  const ready =
    !pending.isLoading &&
    session.status !== 'loading' &&
    !(signedIn && membershipQuery.isPending) &&
    target === null;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // A tapped notification opens its screen (reminders: Hoy), once the app has settled on a
  // member's screens (so the redirects above do not undo it). A tap that launched the app is
  // handled here too.
  const inHousehold = ready && membership === 'member';
  useEffect(() => {
    if (!inHousehold) return;
    let unsubscribeTaps: (() => void) | undefined;
    const cancel = whenNavReady(navRef, () => {
      unsubscribeTaps = onNotificationTapped((data) => router.push(routeForNotification(data)));
    });
    return () => {
      cancel();
      unsubscribeTaps?.();
    };
  }, [navRef, inHousehold, router]);

  // The modals are always transparent and draw their own frame (ModalSheet): full screen on a
  // phone in portrait, a centred sheet over the scrim from `medium` up. A presentation cannot
  // change while a screen is shown, so a fixed one lets a rotation swap the frame without
  // remounting the form. The sheet fades in and out; the full screen keeps the platform's slide.
  // Kept by frame, so a resize within the same frame hands the stack the same options.
  const modal = useMemo(
    () =>
      ({
        presentation: 'transparentModal',
        animation: modalFrame === 'sheet' ? 'fade' : undefined,
      }) as const,
    [modalFrame],
  );

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="task/new" options={modal} />
        <Stack.Screen name="task/[id]" options={modal} />
        <Stack.Screen name="shopping/[id]" options={modal} />
        <Stack.Screen name="templates" options={modal} />
        <Stack.Screen name="help" options={modal} />
      </Stack>
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

/**
 * The status bar follows the theme: dark clock and icons on the cream light theme, light ones on
 * the dark theme. Kept the same under a modal sheet: the light scrim is still pale enough for
 * dark icons, and the dark scrim for light ones.
 */
function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

/** A build without its Supabase settings: says so, reports it once and goes no further. */
function ConfigMissing() {
  useEffect(() => {
    void SplashScreen.hideAsync();
    captureError(new Error('config missing'), { missing: configProblem });
  }, []);
  return <FatalScreen kind="config" detail={configProblem.join('\n')} />;
}

export default withTelemetry(function RootLayout() {
  return configProblem.length > 0 ? <ConfigMissing /> : <App />;
});

function App() {
  // Nothing navigates or renders until the display fonts are registered (the splash stays up).
  // A font that fails to load falls back to the system face; it must not keep the splash up.
  const [fontsLoaded, fontError] = useFonts({
    [displayFont]: MPLUSRounded1c_800ExtraBold,
    [displayFontBold]: MPLUSRounded1c_700Bold,
    [displayFontRegular]: MPLUSRounded1c_400Regular,
  });
  const fontsReady = fontsLoaded || fontError !== null;
  return (
    <RootErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <ThemedStatusBar />
          <TabBarHeightProvider>
            <NoticeProvider>
              <SessionProvider>
                <PersistedQueries>{fontsReady ? <Guard /> : null}</PersistedQueries>
              </SessionProvider>
            </NoticeProvider>
          </TabBarHeightProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </RootErrorBoundary>
  );
}
