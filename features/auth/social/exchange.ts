import { supabase } from '@/data/supabase/client';

const exchanges = new Map<string, Promise<void>>();

/**
 * Exchanges a PKCE code once. On Android the same casa://auth/callback link reaches both the
 * browser session and the router, and a code is single-use: every caller shares one exchange.
 */
export function exchangeCodeOnce(code: string): Promise<void> {
  let p = exchanges.get(code);
  if (!p) {
    p = supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) throw error;
    });
    exchanges.set(code, p);
  }
  return p;
}
