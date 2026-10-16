import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exchangeCodeOnce } from './exchange';

const { exchangeCodeForSession } = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn() }));
vi.mock('@/data/supabase/client', () => ({ supabase: { auth: { exchangeCodeForSession } } }));

describe('exchangeCodeOnce', () => {
  beforeEach(() => exchangeCodeForSession.mockReset());

  it('exchanges the same code only once for every caller', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    await Promise.all([exchangeCodeOnce('same'), exchangeCodeOnce('same')]);
    await exchangeCodeOnce('same');
    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });

  it('exchanges different codes separately', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    await exchangeCodeOnce('a');
    await exchangeCodeOnce('b');
    expect(exchangeCodeForSession).toHaveBeenCalledTimes(2);
  });

  it('rejects every caller when the exchange fails', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error('bad') });
    await expect(exchangeCodeOnce('bad')).rejects.toThrow('bad');
    await expect(exchangeCodeOnce('bad')).rejects.toThrow('bad');
  });
});
