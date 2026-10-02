export type RouteInput = {
  session: 'loading' | 'signed-out' | 'signed-in';
  membership: 'loading' | 'none' | 'member';
  hasPendingInvite: boolean;
  group: 'root' | 'auth' | 'onboarding' | 'invite' | 'app';
};

export type ResolvedRoute = '/sign-in' | '/onboarding' | '/invite' | '/today';

/** Where the guard should send the user, or null to stay on the current screen. */
export function resolveRoute(input: RouteInput): ResolvedRoute | null {
  const { session, membership, hasPendingInvite, group } = input;

  if (session === 'loading') return null;
  if (session === 'signed-out') return group === 'auth' || group === 'invite' ? null : '/sign-in';
  if (membership === 'loading') return null;

  if (membership === 'none') {
    if (hasPendingInvite) return group === 'invite' ? null : '/invite';
    // The invite screen is reachable without a household (it is how you get one).
    return group === 'invite' || group === 'onboarding' ? null : '/onboarding';
  }

  // member
  if (hasPendingInvite) return group === 'invite' ? null : '/invite';
  return group === 'root' || group === 'auth' || group === 'onboarding' ? '/today' : null;
}
