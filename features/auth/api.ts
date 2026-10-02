import { supabase } from '@/data/supabase/client';
import { AuthFailure, toAuthFailure } from './errors';

export { AuthFailure, toAuthFailure } from './errors';
export type { AuthErrorCode } from './errors';

type SignUpArgs = { displayName: string; email: string; password: string };
type SignInArgs = { email: string; password: string };

export async function signUp({ displayName, email, password }: SignUpArgs): Promise<void> {
  let result;
  try {
    result = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
  } catch (e) {
    throw toAuthFailure(e);
  }
  if (result.error) throw toAuthFailure(result.error);
  // With email-enumeration protection, an existing email returns a user with no identities.
  if (result.data.user?.identities?.length === 0) throw new AuthFailure('EMAIL_TAKEN');
}

export async function signIn({ email, password }: SignInArgs): Promise<void> {
  let result;
  try {
    result = await supabase.auth.signInWithPassword({ email, password });
  } catch (e) {
    throw toAuthFailure(e);
  }
  if (result.error) throw toAuthFailure(result.error);
}

export async function signOut(): Promise<void> {
  let result;
  try {
    result = await supabase.auth.signOut();
  } catch (e) {
    throw toAuthFailure(e);
  }
  if (result.error) throw toAuthFailure(result.error);
}
