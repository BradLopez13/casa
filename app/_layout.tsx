import { MPLUSRounded1c_800ExtraBold } from '@expo-google-fonts/m-plus-rounded-1c/800ExtraBold';
import NetInfo from '@react-native-community/netinfo';
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import Constants from 'expo-constants';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { appQueryDefaults } from '@/data/query/defaults';
import { cachedHouseholdIds, endedHouseholdIds } from '@/data/query/ended-household';
import { forgetEndedHousehold, persister } from '@/data/query/persist';
import { toAppError } from '@/data/supabase/errors';
import { signOut } from '@/features/auth/api';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { NoticeProvider, useNotice } from '@/ui/components/Notice';
import { Screen } from '@/ui/components/Screen';
import { useTheme } from '@/ui/theme';
import { displayFont } from '@/ui/tokens';
import { resolveRoute, type RouteInput } from '@/domain/navigation/resolve-route';
import { SessionProvider, useSession } from '@/features/auth/SessionProvider';
import { usePendingInvite } from '@/features/households/pending-invite';
import { useMembership } from '@/features/households/queries';
import {
  addKey,
  boughtKey,
  buildShoppingMutationDefaults,
  persistBuster,
  persistDehydrateOptions,
  resumeShoppingQueue,
} from '@/features/shopping/offline';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({ defaultOptions: appQueryDefaults });

// Refetch stale queries when the app returns to the foreground.
if (Platform.OS !== 'web') {
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (state) => {
      handleFocus(state === 'active');
    });
    return () => subscription.remove();
  });
  // Tracks the connection: the shopping queue pauses while offline and resumes when it is
  // back, and the offline band shows. On the web the default listener (the browser's online
  // and offline events) already does this.
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(state.isConnected === true && state.isInternetReachable !== false);
    }),
  );
}

const PERSIST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const appVersion = Constants.expoConfig?.version ?? '0';

/**
 * Restores the shopping list and its offline queue, and keeps them on the device. It waits for
 * the session (the splash stays up) because the persisted cache belongs to one user: a cache
 * saved under someone else is discarded. A change of user remounts it, so from then on the
 * cache is saved under the new user.
 */
function PersistedQueries({ children }: { children: ReactNode }) {
  const notify = useNotice();
  const { status, userId } = useSession();
  // The queued mutations' functions must be registered before the cache is restored. The
  // notice is reachable from here, so the defaults use it directly.
  useState(() => {
    const defaults = buildShoppingMutationDefaults(queryClient, notify);
    queryClient.setMutationDefaults(addKey, defaults.add);
    queryClient.setMutationDefaults(boughtKey, defaults.bought);
    return null;
  });
  if (status === 'loading') return null;
  const buster = persistBuster(appVersion, userId);
  return (
    <PersistQueryClientProvider
      key={buster}
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: PERSIST_MAX_AGE_MS,
        buster,
        dehydrateOptions: persistDehydrateOptions,
      }}
      // Not awaited: the provider stays in its restoring state until onSuccess settles, and the
      // queue may take as long as the connection does.
      onSuccess={() => {
        void resumeShoppingQueue(queryClient);
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
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

function Guard() {
  const router = useRouter();
  const segments = useSegments();
  const session = useSession();
  const membershipQuery = useMembership();
  const pending = usePendingInvite();
  useForgetEndedHousehold(membershipQuery.data);

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
    !pending.isLoading &&
    session.status !== 'loading' &&
    !(signedIn && membershipQuery.isPending) &&
    target === null;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="task/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="task/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="shopping/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="templates" options={{ presentation: 'modal' }} />
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

export default function RootLayout() {
  // Nothing navigates or renders until the display font is registered (the splash stays up).
  // A font that fails to load falls back to the system face; it must not keep the splash up.
  const [fontsLoaded, fontError] = useFonts({ [displayFont]: MPLUSRounded1c_800ExtraBold });
  const fontsReady = fontsLoaded || fontError !== null;
  return (
    <QueryClientProvider client={queryClient}>
      <NoticeProvider>
        <SessionProvider>
          <PersistedQueries>{fontsReady ? <Guard /> : null}</PersistedQueries>
        </SessionProvider>
      </NoticeProvider>
    </QueryClientProvider>
  );
}
