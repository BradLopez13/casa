import { supabase } from '@/data/supabase/client';
import { toSocialFailure } from './failure';

/** Redirect OAuth: the page leaves for Apple and comes back through /auth/callback. */
export async function signInWithApple(): Promise<void> {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: window.location.origin + '/auth/callback' },
    });
    if (error) throw error;
  } catch (e) {
    throw toSocialFailure(e);
  }
}
