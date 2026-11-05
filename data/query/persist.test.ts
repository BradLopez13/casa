import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { householdsKey, membershipKey } from '@/features/households/keys';
import { forgetHouseholdData, saveCacheNow } from './persist';
import { queuedFn } from './retry';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
}));

const casa = { householdId: 'casa', householdName: 'Casa' };
const mama = { householdId: 'mama', householdName: 'Casa de mamá' };

/** Two households with data and a queued change each. */
function twoHouseholds() {
  const client = new QueryClient();
  client.setQueryData(householdsKey, [casa, mama]);
  client.setQueryData(membershipKey, mama);
  for (const id of ['casa', 'mama']) {
    client.setQueryData(['tasks', id], []);
    client.setQueryData(['shopping', id], []);
    client.setQueryData(['members', id], []);
    client.getMutationCache().build(client, { mutationKey: ['shopping', 'add'] }, {
      variables: { householdId: id },
    } as never);
  }
  return client;
}

const queuedFor = (client: QueryClient) =>
  client
    .getMutationCache()
    .getAll()
    .map((m) => (m.state.variables as { householdId: string }).householdId);

describe('forgetHouseholdData (bloque 12)', () => {
  it('leaving one household forgets its data and its queue, and keeps the other’s', () => {
    const client = twoHouseholds();
    forgetHouseholdData(client, 'mama');
    expect(client.getQueryData(['tasks', 'mama'])).toBeUndefined();
    expect(client.getQueryData(['shopping', 'mama'])).toBeUndefined();
    expect(client.getQueryData(['tasks', 'casa'])).toEqual([]);
    expect(client.getQueryData(['shopping', 'casa'])).toEqual([]);
    expect(queuedFor(client)).toEqual(['casa']);
  });

  it('and moves to the next household', () => {
    const client = twoHouseholds();
    expect(forgetHouseholdData(client, 'mama')).toEqual(casa);
    expect(client.getQueryData(membershipKey)).toEqual(casa);
    expect(client.getQueryData(householdsKey)).toEqual([casa]);
  });

  it('leaving the last one leaves no household', () => {
    const client = twoHouseholds();
    forgetHouseholdData(client, 'mama');
    expect(forgetHouseholdData(client, 'casa')).toBeNull();
    expect(client.getQueryData(membershipKey)).toBeNull();
    expect(queuedFor(client)).toEqual([]);
  });
});

describe('a queued change of a household left (bloque 14.4, T6)', () => {
  // TanStack goes on with the tries of a mutation taken out of its cache: it reached the server
  // after leaving and said NOT_A_MEMBER with a notice.
  it('never reaches the server once the household is forgotten', async () => {
    const client = twoHouseholds();
    const send = vi.fn(() => Promise.resolve());
    const fn = queuedFn(send);
    const mutation = client
      .getMutationCache()
      .findAll()
      .find((m) => (m.state.variables as { householdId: string }).householdId === 'mama')!;
    forgetHouseholdData(client, 'mama');
    await expect(fn(mutation.state.variables as object, {})).rejects.toMatchObject({
      code: 'QUEUE_DROPPED',
    });
    expect(send).not.toHaveBeenCalled();
  });
});

describe('saveCacheNow (bloque 13, Aud P3-3)', () => {
  it('writes the cache at once, in the shape the persister restores', async () => {
    const client = new QueryClient();
    client.setQueryData(['tasks', 'casa'], [{ id: 't1' }]);
    await saveCacheNow(client, 'b', { shouldDehydrateQuery: () => true });
    const [key, value] = vi.mocked(AsyncStorage.setItem).mock.calls.at(-1)!;
    expect(key).toBe('casa-query-cache');
    const saved = JSON.parse(value) as {
      buster: string;
      clientState: { queries: { queryKey: unknown[] }[] };
    };
    expect(saved.buster).toBe('b');
    expect(saved.clientState.queries.map((q) => q.queryKey)).toEqual([['tasks', 'casa']]);
  });
});
