import { MutationObserver, onlineManager, QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';
import { AppError } from '@/data/supabase/errors';
import { appQueryDefaults } from './defaults';

const network = () => Promise.reject(new AppError('NETWORK'));

afterEach(() => {
  onlineManager.setOnline(true);
});

describe('appQueryDefaults', () => {
  it('fails a mutation fast with NETWORK while offline instead of pausing it', async () => {
    const queryClient = new QueryClient({ defaultOptions: appQueryDefaults });
    onlineManager.setOnline(false);
    const observer = new MutationObserver(queryClient, {
      mutationKey: ['tasks', 'toggle'],
      mutationFn: network,
    });
    await expect(observer.mutate(undefined)).rejects.toMatchObject({ code: 'NETWORK' });
    expect(queryClient.getMutationCache().getAll()[0]?.state.isPaused).toBe(false);
  });

  it('fails a query fast with NETWORK while offline instead of pausing it', async () => {
    const queryClient = new QueryClient({ defaultOptions: appQueryDefaults });
    onlineManager.setOnline(false);
    await expect(
      queryClient.fetchQuery({ queryKey: ['tasks', 'h'], queryFn: network, retryDelay: 0 }),
    ).rejects.toMatchObject({ code: 'NETWORK' });
    expect(queryClient.getQueryState(['tasks', 'h'])).toMatchObject({
      status: 'error',
      fetchStatus: 'idle',
    });
  });
});
