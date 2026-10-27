export type RouteInput = {
  session: 'loading' | 'signed-out' | 'signed-in';
  /** How many households the person is in (bloque 12: one person, several households). */
  households: 'loading' | number;
  hasPendingInvite: boolean;
  group: 'root' | 'auth' | 'onboarding' | 'invite' | 'app';
};

export type ResolvedRoute = '/sign-in' | '/onboarding' | '/invite' | '/today';

/** Where the guard should send the user, or null to stay on the current screen. */
export function resolveRoute(input: RouteInput): ResolvedRoute | null {
  const { session, households, hasPendingInvite, group } = input;

  if (session === 'loading') return null;
  if (session === 'signed-out') return group === 'auth' || group === 'invite' ? null : '/sign-in';
  if (households === 'loading') return null;

  if (households === 0) {
    if (hasPendingInvite) return group === 'invite' ? null : '/invite';
    // The invite screen is reachable without a household (it is how you get one).
    return group === 'invite' || group === 'onboarding' ? null : '/onboarding';
  }

  // In one household or more. A pending invite is accepted even so, and leads to the new one.
  if (hasPendingInvite) return group === 'invite' ? null : '/invite';
  return group === 'root' || group === 'auth' || group === 'onboarding' ? '/today' : null;
}
