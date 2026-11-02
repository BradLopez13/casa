import { describe, expect, it, vi } from 'vitest';
import {
  appleClientSecret,
  appleRevokeRequest,
  appleTokenRequest,
  handleRevokeApple,
  type AppleConfig,
} from './apple';

/** A throwaway ES256 key pair, the private half as the PEM Apple hands out in the .p8. */
async function keyPair() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ]);
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
  const base64 = Buffer.from(pkcs8).toString('base64');
  const pem = `-----BEGIN PRIVATE KEY-----\n${base64.match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----`;
  return { pem, publicKey: pair.publicKey };
}

const decode = (part: string) =>
  JSON.parse(
    Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(),
  ) as Record<string, unknown>;

// Bloque 15.4: App Review asks since 2022 that deleting the account revokes the Sign in with Apple
// token. The client secret is a JWT signed with the .p8 key (ES256), as Apple's docs say.
describe('appleClientSecret', () => {
  it('is an ES256 JWT with the team, the key, the client and Apple as audience', async () => {
    const { pem, publicKey } = await keyPair();
    const config: AppleConfig = {
      teamId: 'TEAM123456',
      keyId: 'KEY1234567',
      privateKey: pem,
      clientId: 'com.bradlopez13.casa',
    };
    const now = 1_800_000_000;
    const jwt = await appleClientSecret(config, now);
    const [header, claims, signature] = jwt.split('.');
    expect(decode(header!)).toEqual({ alg: 'ES256', kid: 'KEY1234567', typ: 'JWT' });
    expect(decode(claims!)).toEqual({
      iss: 'TEAM123456',
      iat: now,
      exp: now + 180 * 24 * 60 * 60,
      aud: 'https://appleid.apple.com',
      sub: 'com.bradlopez13.casa',
    });
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      Buffer.from(signature!.replace(/-/g, '+').replace(/_/g, '/'), 'base64'),
      new TextEncoder().encode(`${header}.${claims}`),
    );
    expect(ok).toBe(true);
  });
});

describe('the requests to Apple', () => {
  it('exchange the authorization code for tokens, as a form', async () => {
    const request = appleTokenRequest('secret', 'com.bradlopez13.casa', 'code-1');
    expect(request.url).toBe('https://appleid.apple.com/auth/token');
    expect(request.method).toBe('POST');
    expect(await request.text()).toBe(
      'client_id=com.bradlopez13.casa&client_secret=secret&code=code-1&grant_type=authorization_code',
    );
  });

  it('revoke the refresh token', async () => {
    const request = appleRevokeRequest('secret', 'com.bradlopez13.casa', 'refresh-1');
    expect(request.url).toBe('https://appleid.apple.com/auth/revoke');
    expect(await request.text()).toBe(
      'client_id=com.bradlopez13.casa&client_secret=secret&token=refresh-1&token_type_hint=refresh_token',
    );
  });
});

describe('handleRevokeApple', () => {
  const config: AppleConfig = { teamId: 't', keyId: 'k', privateKey: 'p', clientId: 'c' };
  const deps = () => ({
    secret: async () => 'secret',
    fetch: vi.fn<(request: Request) => Promise<Response>>(),
    saveToken: vi.fn<(userId: string, token: string) => Promise<void>>(),
    loadToken: vi.fn<(userId: string) => Promise<string | null>>(),
    forgetToken: vi.fn<(userId: string) => Promise<void>>(),
    log: vi.fn<(message: string) => void>(),
  });
  const post = (body: unknown) =>
    new Request('https://x/revoke-apple', { method: 'POST', body: JSON.stringify(body) });

  it('says it is not configured without the secrets, and touches nothing', async () => {
    const d = deps();
    const response = await handleRevokeApple(post({ action: 'revoke' }), 'u1', null, d);
    expect(await response.json()).toEqual({ configured: false });
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it('stores the refresh token after a sign-in on iOS', async () => {
    const d = deps();
    d.fetch.mockResolvedValue(
      new Response(JSON.stringify({ refresh_token: 'r-1', access_token: 'a' }), { status: 200 }),
    );
    const response = await handleRevokeApple(
      post({ action: 'store', code: 'code-1' }),
      'u1',
      config,
      d,
    );
    expect(await response.json()).toEqual({ stored: true });
    expect(d.saveToken).toHaveBeenCalledWith('u1', 'r-1');
    expect(d.fetch.mock.calls[0]![0].url).toBe('https://appleid.apple.com/auth/token');
  });

  it('revokes the token kept for the person and forgets it', async () => {
    const d = deps();
    d.loadToken.mockResolvedValue('r-1');
    d.fetch.mockResolvedValue(new Response('', { status: 200 }));
    const response = await handleRevokeApple(post({ action: 'revoke' }), 'u1', config, d);
    expect(await response.json()).toEqual({ revoked: true });
    expect(d.fetch.mock.calls[0]![0].url).toBe('https://appleid.apple.com/auth/revoke');
    expect(d.forgetToken).toHaveBeenCalledWith('u1');
  });

  it('never fails the account deletion: Apple down is logged and answered as not revoked', async () => {
    const d = deps();
    d.loadToken.mockResolvedValue('r-1');
    d.fetch.mockRejectedValue(new Error('offline'));
    const response = await handleRevokeApple(post({ action: 'revoke' }), 'u1', config, d);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revoked: false });
    expect(d.log).toHaveBeenCalledWith(expect.stringContaining('offline'));
    expect(d.forgetToken).not.toHaveBeenCalled();
  });

  it('answers not revoked for a person without an Apple token', async () => {
    const d = deps();
    d.loadToken.mockResolvedValue(null);
    const response = await handleRevokeApple(post({ action: 'revoke' }), 'u1', config, d);
    expect(await response.json()).toEqual({ revoked: false });
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it('refuses an unknown action', async () => {
    const response = await handleRevokeApple(post({ action: 'x' }), 'u1', config, deps());
    expect(response.status).toBe(400);
  });
});
