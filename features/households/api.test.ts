import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '@/data/supabase/client';
import { listMyHouseholds } from './api';

vi.mock('@/data/supabase/client', () => ({
  supabase: { auth: { getSession: vi.fn() }, rpc: vi.fn(), from: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(supabase.auth.getSession).mockReset();
});

// Bloque 15.1 (P3-10): with no session the list came back empty, which `useForgetEndedHousehold`
// would read as «every household ended» and forget their queues.
describe('listMyHouseholds without a session', () => {
  it('says it does not know, never that there are none', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as never);
    await expect(listMyHouseholds()).rejects.toMatchObject({ code: 'NOT_AUTHENTICATED' });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
