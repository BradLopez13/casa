import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listMyHouseholds, type Membership } from './api';
import { householdsKey, membershipKey } from './keys';
import { loadActiveMembership, setActiveHousehold } from './queries';

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  listMyHouseholds: vi.fn(),
}));

const casa: Membership = { householdId: 'casa', householdName: 'Casa', role: 'owner', rooms: [] };
const mama: Membership = {
  householdId: 'mama',
  householdName: 'Casa de mamá',
  role: 'owner',
  rooms: [],
};

beforeEach(async () => {
  vi.mocked(listMyHouseholds).mockReset();
  await AsyncStorage.clear();
});

describe('the active household (bloque 12)', () => {
  it('without households there is none', async () => {
    vi.mocked(listMyHouseholds).mockResolvedValue([]);
    expect(await loadActiveMembership(new QueryClient(), 'me')).toBeNull();
  });

  it('with one, it is that one', async () => {
    vi.mocked(listMyHouseholds).mockResolvedValue([casa]);
    expect(await loadActiveMembership(new QueryClient(), 'me')).toEqual(casa);
  });

  it('with several, the one this phone chose, and the list is kept', async () => {
    vi.mocked(listMyHouseholds).mockResolvedValue([casa, mama]);
    await AsyncStorage.setItem('casa-active-household-me', 'mama');
    const client = new QueryClient();
    expect(await loadActiveMembership(client, 'me')).toEqual(mama);
    expect(client.getQueryData(householdsKey)).toEqual([casa, mama]);
  });

  it('switching shows the other household at once and remembers it on the phone', async () => {
    const client = new QueryClient();
    client.setQueryData(householdsKey, [casa, mama]);
    client.setQueryData(membershipKey, casa);
    await setActiveHousehold(client, 'me', 'mama');
    expect(client.getQueryData(membershipKey)).toEqual(mama);
    expect(await AsyncStorage.getItem('casa-active-household-me')).toBe('mama');
  });

  it('switching to a household the person is not in changes nothing on screen', async () => {
    const client = new QueryClient();
    client.setQueryData(householdsKey, [casa]);
    client.setQueryData(membershipKey, casa);
    await setActiveHousehold(client, 'me', 'someone-else');
    expect(client.getQueryData(membershipKey)).toEqual(casa);
  });

  it('a fresh list keeps the household shown, with its new name', async () => {
    const client = new QueryClient();
    client.setQueryData(membershipKey, mama);
    await AsyncStorage.setItem('casa-active-household-me', 'mama');
    const renamed = { ...mama, householdName: 'La de mamá' };
    vi.mocked(listMyHouseholds).mockResolvedValue([casa, renamed]);
    expect(await loadActiveMembership(client, 'me')).toEqual(renamed);
  });

  it('when the household shown is gone from the list, the next one', async () => {
    const client = new QueryClient();
    client.setQueryData(membershipKey, mama);
    await AsyncStorage.setItem('casa-active-household-me', 'mama');
    vi.mocked(listMyHouseholds).mockResolvedValue([casa]);
    expect(await loadActiveMembership(client, 'me')).toEqual(casa);
  });
});
