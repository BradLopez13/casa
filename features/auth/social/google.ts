import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { supabase } from '@/data/supabase/client';
import { AuthFailure } from '../errors';
import { toSocialFailure } from './failure';

let configured = false;

function configure() {
  if (configured) return;
  GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID });
  configured = true;
}

/** Native Google sign-in, then exchanges the Google ID token for a Supabase session. */
export async function signInWithGoogle(): Promise<void> {
  try {
    configure();
    await GoogleSignin.hasPlayServices();
    const r = await GoogleSignin.signIn();
    if (!isSuccessResponse(r)) throw new AuthFailure('OAUTH_CANCELLED');
    const token = r.data.idToken;
    if (!token) throw new AuthFailure('UNKNOWN');
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token });
    if (error) {
      // Forget the Google account so the next tap shows the chooser instead of retrying it.
      await GoogleSignin.signOut().catch(() => undefined);
      throw error;
    }
  } catch (e) {
    throw toSocialFailure(e);
  }
}

export async function signOutOfGoogle(): Promise<void> {
  try {
    configure();
    await GoogleSignin.signOut();
  } catch {
    // Best effort: never blocks the app sign-out.
  }
}
