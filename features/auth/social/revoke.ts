import { supabase } from '@/data/supabase/client';

/**
 * Sign in with Apple and the account's end (bloque 15.4): App Review asks that deleting the
 * account revokes the person's Apple token. The revoke-apple function keeps the refresh token
 * it gets for the authorization code at sign-in (`storeAppleCode`) and revokes it right before
 * delete_account (`revokeAppleSignIn`). Neither call may stop a sign-in or a deletion: both are
 * best effort, and without the APPLE_* secrets the function answers that it is not configured.
 */
export async function storeAppleCode(code: string): Promise<void> {
  try {
    await supabase.functions.invoke('revoke-apple', { body: { action: 'store', code } });
  } catch {
    // Best effort.
  }
}

/** Whether Apple revoked the token; false when there was none, or the function could not. */
export async function revokeAppleSignIn(): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke<{ revoked?: boolean }>('revoke-apple', {
      body: { action: 'revoke' },
    });
    return !error && data?.revoked === true;
  } catch {
    return false;
  }
}
