export type SocialProvider = 'google' | 'apple';

type Input = {
  env: { google?: string; apple?: string };
  platform: 'ios' | 'android' | 'web';
  inExpoGo: boolean;
};

/** Which social buttons to show, in display order. Native sign-in needs a dev build, not Expo Go. */
export function visibleProviders({ env, platform, inExpoGo }: Input): SocialProvider[] {
  if (inExpoGo && platform !== 'web') return [];
  const list: SocialProvider[] = [];
  if (env.google === '1') list.push('google');
  if (env.apple === '1') list.push('apple');
  return list;
}
