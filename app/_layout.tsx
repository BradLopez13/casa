import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { resolveRoute, type RouteInput } from '@/domain/navigation/resolve-route';
import { SessionProvider, useSession } from '@/features/auth/SessionProvider';
import { useMembership } from '@/features/households/queries';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

function groupOf(segment: string | undefined): RouteInput['group'] {
  switch (segment) {
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
  const membership: RouteInput['membership'] =
    !signedIn || membershipQuery.isPending || membershipQuery.isError
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

  const ready = session.status !== 'loading' && !(signedIn && membershipQuery.isPending);
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  return <Stack screenOptions={{ headerShown: false }} />;
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
