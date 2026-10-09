import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { cachedHouseholdIds, endedHouseholdIds } from './ended-household';

describe('endedHouseholdIds', () => {
  it('forgets nothing while the membership is still unknown', () => {
    expect(endedHouseholdIds(['h'], undefined)).toEqual([]);
  });

  it('forgets nothing while the membership is the cached household', () => {
    expect(endedHouseholdIds(['h'], { householdId: 'h' })).toEqual([]);
  });

  it('forgets the cached household when the membership is gone', () => {
    expect(endedHouseholdIds(['h'], null)).toEqual(['h']);
  });

  it('forgets the cached household when the membership is another household', () => {
    expect(endedHouseholdIds(['h', 'k'], { householdId: 'k' })).toEqual(['h']);
  });

  it('forgets nothing when nothing is cached', () => {
    expect(endedHouseholdIds([], null)).toEqual([]);
  });
});

describe('cachedHouseholdIds', () => {
  it('lists each household with shopping data, members or a queued shopping change', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['shopping', 'h'], []);
    queryClient.setQueryData(['shopping-history', 'h'], []);
    queryClient.setQueryData(['members', 'k'], []);
    queryClient.setQueryData(['tasks', 't'], []);
    queryClient.setQueryData(['membership'], { householdId: 'm' });
    queryClient.getMutationCache().build(queryClient, { mutationKey: ['shopping', 'add'] }, {
      variables: { householdId: 'q' },
    } as never);
    expect(cachedHouseholdIds(queryClient).sort()).toEqual(['h', 'k', 'q']);
  });

  it('ignores the queries built before there was a household', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['shopping', undefined], []);
    expect(cachedHouseholdIds(queryClient)).toEqual([]);
  });
});
