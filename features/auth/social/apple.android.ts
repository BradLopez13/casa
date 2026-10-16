import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/data/supabase/client';
import { AuthFailure } from '../errors';
import { toSocialFailure } from './failure';
import { callbackCode } from './nonce';

/** Apple through the browser (PKCE): the code comes back in the redirect URL and is exchanged here. */
export async function signInWithApple(): Promise<void> {
  try {
    const redirectTo = Linking.createURL('auth/callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') throw new AuthFailure('OAUTH_CANCELLED');
    const code = callbackCode(Object.fromEntries(new URL(result.url).searchParams));
    if (!code) throw new AuthFailure('UNKNOWN');
    const exchanged = await supabase.auth.exchangeCodeForSession(code);
    if (exchanged.error) throw exchanged.error;
  } catch (e) {
    throw toSocialFailure(e);
  }
}
