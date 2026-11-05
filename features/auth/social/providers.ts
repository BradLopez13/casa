export type SocialProvider = 'google' | 'apple';

type Input = {
  /** The switches, and the iOS client id of Google (bloque 15.4): without it, no Google on iOS. */
  env: { google?: string; apple?: string; googleIos?: string };
  platform: 'ios' | 'android' | 'web';
  inExpoGo: boolean;
};

/** Which social buttons to show, in display order. Native sign-in needs a dev build, not Expo Go. */
export function visibleProviders({ env, platform, inExpoGo }: Input): SocialProvider[] {
  if (inExpoGo && platform !== 'web') return [];
  const list: SocialProvider[] = [];
  // On iOS GIDSignIn needs its own client id (and the URL scheme in the build): without it the
  // button stays hidden, as before the variable existed (bloque 15.4).
  if (env.google === '1' && (platform !== 'ios' || !!env.googleIos)) list.push('google');
  if (env.apple === '1') list.push('apple');
  return list;
}
