import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/data/supabase/client';
import { AuthFailure } from '../errors';
import { exchangeCodeOnce } from './exchange';
import { toSocialFailure } from './failure';
import { callbackCancelled, callbackCode } from './nonce';

// A constant, not Linking.createURL: in a dev client that one carries the Metro host, which
// Supabase would reject against its redirect allow-list.
const REDIRECT_TO = 'casa://auth/callback';

/** Apple through the browser (PKCE): the code comes back in the redirect URL and is exchanged here. */
export async function signInWithApple(): Promise<void> {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: REDIRECT_TO, skipBrowserRedirect: true },
    });
    if (error) throw error;
    const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_TO);
    if (result.type !== 'success') throw new AuthFailure('OAUTH_CANCELLED');
    const params = Object.fromEntries(new URL(result.url).searchParams);
    const code = callbackCode(params);
    if (!code) throw new AuthFailure(callbackCancelled(params) ? 'OAUTH_CANCELLED' : 'UNKNOWN');
    await exchangeCodeOnce(code);
  } catch (e) {
    throw toSocialFailure(e);
  }
}
