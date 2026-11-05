// Revoking Sign in with Apple when the account is deleted (bloque 15.4): App Review asks for it
// since June 2022. Apple's revoke endpoint wants a token the app got in exchange for the
// authorization code at sign-in, so the exchange happens then (`store`) and the refresh token
// waits, out of the API's reach, until the person deletes the account (`revoke`). The client
// secret is a JWT signed with the team's .p8 key (ES256), good for six months at most.
//
// Pure logic, apart from Deno so Vitest can run it: the function's entry point hands in the
// fetch, the secret and where the token is kept. Nothing here imports anything.

export type AppleConfig = {
  /** Apple Developer → Membership. */
  teamId: string;
  /** The key id of the Sign in with Apple .p8. */
  keyId: string;
  /** The .p8 as PEM (`-----BEGIN PRIVATE KEY-----…`). */
  privateKey: string;
  /**
   * The client the token was issued to: the bundle id, since only the native sign-in on iOS hands
   * the app an authorization code (on Android Apple goes through Supabase, which never shows it).
   */
  clientId: string;
};

const APPLE = 'https://appleid.apple.com';
/** Six months: the longest Apple accepts. */
const SECRET_TTL_S = 180 * 24 * 60 * 60;

const base64url = (bytes: Uint8Array | ArrayBuffer): string => {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const utf8 = (text: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(text);

function pemToPkcs8(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** The client secret Apple's token endpoints take: a JWT signed with the .p8 (ES256). */
export async function appleClientSecret(
  config: AppleConfig,
  now: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  const header = base64url(utf8(JSON.stringify({ alg: 'ES256', kid: config.keyId, typ: 'JWT' })));
  const claims = base64url(
    utf8(
      JSON.stringify({
        iss: config.teamId,
        iat: now,
        exp: now + SECRET_TTL_S,
        aud: APPLE,
        sub: config.clientId,
      }),
    ),
  );
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(config.privateKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    utf8(`${header}.${claims}`),
  );
  return `${header}.${claims}.${base64url(signature)}`;
}

const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString();

const post = (path: string, body: string) =>
  new Request(`${APPLE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

/** Exchanges the authorization code the app got at sign-in for Apple's tokens. */
export function appleTokenRequest(secret: string, clientId: string, code: string): Request {
  return post(
    '/auth/token',
    form({ client_id: clientId, client_secret: secret, code, grant_type: 'authorization_code' }),
  );
}

/** Revokes the refresh token kept at sign-in: Apple forgets the person's consent to Nido. */
export function appleRevokeRequest(secret: string, clientId: string, token: string): Request {
  return post(
    '/auth/revoke',
    form({ client_id: clientId, client_secret: secret, token, token_type_hint: 'refresh_token' }),
  );
}

export type RevokeDeps = {
  /** The client secret for this call (cached by the caller if it likes). */
  secret: (config: AppleConfig) => Promise<string>;
  fetch: (request: Request) => Promise<Response>;
  saveToken: (userId: string, token: string) => Promise<void>;
  loadToken: (userId: string) => Promise<string | null>;
  forgetToken: (userId: string) => Promise<void>;
  log: (message: string) => void;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * The revoke-apple function's logic. `store` after a sign-in on iOS keeps the refresh token for
 * the person; `revoke` before deleting the account revokes it and forgets it. Without the
 * secrets (`config` null) it says so and touches nothing; Apple failing never fails the caller:
 * the deletion goes on, and the failure is logged.
 */
export async function handleRevokeApple(
  req: Request,
  userId: string,
  config: AppleConfig | null,
  deps: RevokeDeps,
): Promise<Response> {
  if (config === null) return json({ configured: false });
  let body: { action?: unknown; code?: unknown };
  try {
    body = (await req.json()) as { action?: unknown; code?: unknown };
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (body.action === 'store') {
    if (typeof body.code !== 'string' || body.code === '') return json({ error: 'no_code' }, 400);
    try {
      const secret = await deps.secret(config);
      const response = await deps.fetch(appleTokenRequest(secret, config.clientId, body.code));
      const tokens = (await response.json()) as { refresh_token?: unknown };
      if (!response.ok || typeof tokens.refresh_token !== 'string') {
        deps.log(`revoke-apple: no refresh token for ${userId}: ${response.status}`);
        return json({ stored: false });
      }
      await deps.saveToken(userId, tokens.refresh_token);
      return json({ stored: true });
    } catch (error) {
      deps.log(`revoke-apple: store failed for ${userId}: ${errorText(error)}`);
      return json({ stored: false });
    }
  }
  if (body.action === 'revoke') {
    try {
      const token = await deps.loadToken(userId);
      if (token === null) return json({ revoked: false });
      const secret = await deps.secret(config);
      const response = await deps.fetch(appleRevokeRequest(secret, config.clientId, token));
      if (!response.ok) {
        deps.log(`revoke-apple: Apple answered ${response.status} for ${userId}`);
        return json({ revoked: false });
      }
      await deps.forgetToken(userId);
      return json({ revoked: true });
    } catch (error) {
      deps.log(`revoke-apple: revoke failed for ${userId}: ${errorText(error)}`);
      return json({ revoked: false });
    }
  }
  return json({ error: 'unknown_action' }, 400);
}

/** The config from the function's secrets, or null while any of the four is missing. */
export function appleConfigFrom(env: {
  get: (name: string) => string | undefined;
}): AppleConfig | null {
  const teamId = env.get('APPLE_TEAM_ID');
  const keyId = env.get('APPLE_KEY_ID');
  const privateKey = env.get('APPLE_PRIVATE_KEY');
  const clientId = env.get('APPLE_BUNDLE_ID');
  if (!teamId || !keyId || !privateKey || !clientId) return null;
  // A key pasted as one line keeps its line breaks as the two characters `\n`.
  return { teamId, keyId, privateKey: privateKey.replace(/\\n/g, '\n'), clientId };
}
