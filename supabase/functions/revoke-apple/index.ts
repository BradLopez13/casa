// Revokes Sign in with Apple when the account is deleted (bloque 15.4; App Review asks for it).
// Called by the app with the person's JWT (verify_jwt stays on): `store` right after a sign-in
// on iOS keeps the refresh token Apple gives for the authorization code; `revoke` right before
// delete_account revokes it. The token lives in private.apple_tokens, reached only through RPCs
// the service role may call. Without the four APPLE_* secrets the function answers
// `configured: false` and the deletion goes on as today.

import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { appleClientSecret, appleConfigFrom, handleRevokeApple } from '../_shared/apple.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL')!;
  const authorization = req.headers.get('authorization') ?? '';
  // Who calls: the person's own session, read with the anon key and their token.
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await asUser.auth.getUser();
  if (error || !data.user) return json({ error: 'unauthorized' }, 401);
  const userId = data.user.id;

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const rpc = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
    const result = await admin.rpc(name, args);
    if (result.error) throw result.error;
    return result.data as T;
  };

  return handleRevokeApple(req, userId, appleConfigFrom(Deno.env), {
    secret: appleClientSecret,
    fetch: (request) => fetch(request),
    saveToken: (user, token) => rpc('apple_token_save', { p_user_id: user, p_token: token }),
    loadToken: (user) => rpc<string | null>('apple_token_load', { p_user_id: user }),
    forgetToken: (user) => rpc('apple_token_forget', { p_user_id: user }),
    log: (message) => console.error(message),
  });
});
