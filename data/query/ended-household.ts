import type { QueryClient } from '@tanstack/react-query';

const HOUSEHOLD_MUTATIONS: ReadonlySet<unknown> = new Set(['shopping', 'tasks']);

const HOUSEHOLD_QUERIES: ReadonlySet<unknown> = new Set([
  'shopping',
  'shopping-history',
  'shopping-resolved',
  'members',
  'tasks',
]);

/**
 * The households with data kept for them: their shopping list, history, tasks or members, or a
 * queued shopping or task change.
 */
export function cachedHouseholdIds(queryClient: QueryClient): string[] {
  const ids = new Set<string>();
  for (const query of queryClient.getQueryCache().getAll()) {
    const [kind, householdId] = query.queryKey;
    if (HOUSEHOLD_QUERIES.has(kind) && typeof householdId === 'string') ids.add(householdId);
  }
  const mutations = queryClient.getMutationCache().getAll();
  for (const mutation of mutations.filter((m) =>
    HOUSEHOLD_MUTATIONS.has(m.options.mutationKey?.[0]),
  )) {
    const householdId = (mutation.state.variables as { householdId?: unknown } | undefined)
      ?.householdId;
    if (typeof householdId === 'string') ids.add(householdId);
  }
  return [...ids];
}

/**
 * The cached households the user no longer belongs to, once the membership is known: all of
 * them when there is no membership, every other one when it is another household.
 */
export function endedHouseholdIds(
  cached: readonly string[],
  membership: { householdId: string } | null | undefined,
): string[] {
  if (membership === undefined) return [];
  return cached.filter((id) => id !== membership?.householdId);
}
