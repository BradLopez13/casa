import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { cachedHouseholdIds, endedHouseholdIds } from './ended-household';

describe('endedHouseholdIds', () => {
  it('forgets nothing while the households are still unknown', () => {
    expect(endedHouseholdIds(['h'], undefined)).toEqual([]);
  });

  it('forgets nothing while the cached household is still one of them', () => {
    expect(endedHouseholdIds(['h'], [{ householdId: 'h' }])).toEqual([]);
  });

  it('forgets the cached household when there are none left', () => {
    expect(endedHouseholdIds(['h'], [])).toEqual(['h']);
  });

  it('forgets only the household that is no longer in the list', () => {
    expect(endedHouseholdIds(['h', 'k'], [{ householdId: 'k' }])).toEqual(['h']);
  });

  it('keeps the data of every household the person is in, whichever is shown (bloque 12)', () => {
    expect(endedHouseholdIds(['h', 'k'], [{ householdId: 'k' }, { householdId: 'h' }])).toEqual([]);
  });

  it('forgets nothing when nothing is cached', () => {
    expect(endedHouseholdIds([], [])).toEqual([]);
  });
});

describe('cachedHouseholdIds', () => {
  it('lists each household with shopping data, tasks, members or a queued change', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['shopping', 'h'], []);
    queryClient.setQueryData(['shopping-history', 'h'], []);
    queryClient.setQueryData(['members', 'k'], []);
    queryClient.setQueryData(['tasks', 't'], []);
    queryClient.setQueryData(['membership'], { householdId: 'm' });
    queryClient.getMutationCache().build(queryClient, { mutationKey: ['shopping', 'add'] }, {
      variables: { householdId: 'q' },
    } as never);
    // Fase 10e: the tasks and their queue are kept on the device too.
    queryClient.getMutationCache().build(queryClient, { mutationKey: ['tasks', 'toggle'] }, {
      variables: { householdId: 'z' },
    } as never);
    expect(cachedHouseholdIds(queryClient).sort()).toEqual(['h', 'k', 'q', 't', 'z']);
  });

  it('ignores the queries built before there was a household', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['shopping', undefined], []);
    expect(cachedHouseholdIds(queryClient)).toEqual([]);
  });
});
