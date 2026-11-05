import { beforeEach, describe, expect, it, vi } from 'vitest';
import { revokeAppleSignIn, storeAppleCode } from './revoke';

const client = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/data/supabase/client', () => ({
  supabase: { functions: { invoke: client.invoke } },
}));

beforeEach(() => client.invoke.mockReset());

// Bloque 15.4: the Apple token is revoked when the account is deleted (App Review), through the
// revoke-apple function; neither call may ever stop a sign-in or a deletion.
describe('the Apple token', () => {
  it('is kept after a sign-in on iOS, from the authorization code', async () => {
    client.invoke.mockResolvedValue({ data: { stored: true }, error: null });
    await storeAppleCode('code-1');
    expect(client.invoke).toHaveBeenCalledWith('revoke-apple', {
      body: { action: 'store', code: 'code-1' },
    });
  });

  it('is revoked before the account goes, and says whether it was', async () => {
    client.invoke.mockResolvedValue({ data: { revoked: true }, error: null });
    expect(await revokeAppleSignIn()).toBe(true);
    expect(client.invoke).toHaveBeenCalledWith('revoke-apple', { body: { action: 'revoke' } });
  });

  it('never throws: a function that fails or is missing is a quiet false', async () => {
    client.invoke.mockRejectedValue(new Error('down'));
    expect(await revokeAppleSignIn()).toBe(false);
    client.invoke.mockResolvedValue({ data: null, error: { message: 'not found' } });
    expect(await revokeAppleSignIn()).toBe(false);
    await expect(storeAppleCode('code-1')).resolves.toBeUndefined();
  });
});
