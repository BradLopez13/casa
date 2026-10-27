import { QueryClient, dehydrate } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { persistDehydrateOptions } from './persistence';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
}));

const kept = (client: QueryClient) =>
  dehydrate(client, persistDehydrateOptions).queries.map((q) => q.queryKey[0]);

describe('what goes on the device', () => {
  it('keeps a list whose last refresh failed offline, with the data it had (bloque 12)', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['households'], [{ householdId: 'casa' }]);
    await client
      .fetchQuery({
        queryKey: ['households'],
        queryFn: () => Promise.reject(new Error('Network request failed')),
        staleTime: 0,
      })
      .catch(() => undefined);
    expect(client.getQueryState(['households'])?.status).toBe('error');
    expect(kept(client)).toEqual(['households']);
  });

  it('leaves out a list that never loaded and what is not kept on the device', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await client
      .fetchQuery({ queryKey: ['tasks', 'h'], queryFn: () => Promise.reject(new Error('x')) })
      .catch(() => undefined);
    client.setQueryData(['invites', 'h'], []);
    expect(kept(client)).toEqual([]);
  });
});
