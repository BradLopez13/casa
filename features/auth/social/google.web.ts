import { supabase } from '@/data/supabase/client';
import { toSocialFailure } from './failure';

/** Redirect OAuth: the page leaves for Google and comes back through /auth/callback. */
export async function signInWithGoogle(): Promise<void> {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth/callback' },
    });
    if (error) throw error;
  } catch (e) {
    throw toSocialFailure(e);
  }
}

export async function signOutOfGoogle(): Promise<void> {}
