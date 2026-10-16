import { supabase } from '@/data/supabase/client';
import { AuthFailure, toAuthFailure } from './errors';
import { toAppError } from '@/data/supabase/errors';
import { forgetPushRegistration } from '@/features/push/registration';

export { AuthFailure, toAuthFailure } from './errors';
export type { AuthErrorCode } from './errors';

type SignUpArgs = { displayName: string; email: string; password: string };
type SignInArgs = { email: string; password: string };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function signUp({
  displayName,
  email,
  password,
}: SignUpArgs): Promise<'verify' | 'signed-in'> {
  let result;
  try {
    result = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
      options: { data: { display_name: displayName } },
    });
  } catch (e) {
    throw toAuthFailure(e);
  }
  if (result.error) throw toAuthFailure(result.error);
  // With email-enumeration protection, an existing email returns a user with no identities.
  if (result.data.user?.identities?.length === 0) throw new AuthFailure('EMAIL_TAKEN');
  return result.data.session ? 'signed-in' : 'verify';
}

export async function signIn({ email, password }: SignInArgs): Promise<void> {
  const normalized = normalizeEmail(email);
  let result;
  try {
    result = await supabase.auth.signInWithPassword({ email: normalized, password });
  } catch (e) {
    throw toAuthFailure(e);
  }
  if (!result.error) return;
  const failure = toAuthFailure(result.error);
  if (failure.code === 'EMAIL_NOT_CONFIRMED') {
    // Send a fresh code so the user can finish verifying. Best effort: never masks the error.
    await resendSignUpCode(normalized).catch(() => undefined);
  }
  throw failure;
}

export async function verifySignUpCode({
  email,
  code,
}: {
  email: string;
  code: string;
}): Promise<void> {
  let result;
  try {
    result = await supabase.auth.verifyOtp({
      email: normalizeEmail(email),
      token: code,
      type: 'signup',
    });
  } catch (e) {
    throw toAuthFailure(e);
  }
  if (result.error) throw toAuthFailure(result.error);
}

export async function resendSignUpCode(email: string): Promise<void> {
  let result;
  try {
    result = await supabase.auth.resend({ type: 'signup', email: normalizeEmail(email) });
  } catch (e) {
    throw toAuthFailure(e);
  }
  if (result.error) throw toAuthFailure(result.error);
}

export async function requestPasswordReset(email: string): Promise<void> {
  let result;
  try {
    result = await supabase.auth.resetPasswordForEmail(normalizeEmail(email));
  } catch (e) {
    throw toAuthFailure(e);
  }
  if (result.error) throw toAuthFailure(result.error);
}

/** Verifies the recovery code (which signs the user in), then sets the new password. */
export async function resetPassword({
  email,
  code,
  password,
}: {
  email: string;
  code: string;
  password: string;
}): Promise<void> {
  let verified;
  try {
    verified = await supabase.auth.verifyOtp({
      email: normalizeEmail(email),
      token: code,
      type: 'recovery',
    });
  } catch (e) {
    throw toAuthFailure(e);
  }
  if (verified.error) throw toAuthFailure(verified.error);
  let updated;
  try {
    updated = await supabase.auth.updateUser({ password });
  } catch (e) {
    throw toAuthFailure(e);
  }
  if (updated.error) throw toAuthFailure(updated.error);
}

export async function signOut(): Promise<void> {
  // While still signed in, stop the server sending to this phone. Best effort: a failure here
  // never blocks the sign-out.
  await forgetPushRegistration().catch(() => undefined);
  // supabase-js already drops the local session (and emits SIGNED_OUT) when the global
  // sign-out fails with a non-4xx error. Only if a session still remains do we fall back
  // to a local sign-out, so the user is never stuck signed in.
  let failed = false;
  try {
    const result = await supabase.auth.signOut();
    failed = result.error !== null;
  } catch {
    failed = true;
  }
  if (!failed) return;
  let remaining;
  try {
    remaining = (await supabase.auth.getSession()).data.session;
  } catch {
    remaining = null;
  }
  if (!remaining) return;
  let local;
  try {
    local = await supabase.auth.signOut({ scope: 'local' });
  } catch (e) {
    throw toAuthFailure(e);
  }
  if (local.error) throw toAuthFailure(local.error);
}

/** Deletes the account on the server. Does not sign out: the caller cleans up first. */
export async function deleteAccount(): Promise<void> {
  let result;
  try {
    result = await supabase.rpc('delete_account');
  } catch (e) {
    throw toAppError(e);
  }
  if (result.error) throw toAppError(result.error);
}

/** Drops the local session only (the server-side token is already gone after deletion). */
export async function signOutLocally(): Promise<void> {
  let result;
  try {
    result = await supabase.auth.signOut({ scope: 'local' });
  } catch (e) {
    throw toAuthFailure(e);
  }
  if (result.error) throw toAuthFailure(result.error);
}
