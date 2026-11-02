import { describe, expect, it, vi } from 'vitest';
import { listMyHouseholds } from './api';

const client = vi.hoisted(() => ({
  getSession: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/data/supabase/client', () => ({
  supabase: { auth: { getSession: client.getSession }, rpc: client.rpc, from: vi.fn() },
}));

// Bloque 15.1 (P3-10): with no session the list came back empty, which `useForgetEndedHousehold`
// would read as «every household ended» and forget their queues.
describe('listMyHouseholds without a session', () => {
  it('says it does not know, never that there are none', async () => {
    client.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(listMyHouseholds()).rejects.toMatchObject({ code: 'NOT_AUTHENTICATED' });
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
