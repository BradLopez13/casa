import type { QueryClient } from '@tanstack/react-query';

const HOUSEHOLD_MUTATIONS: ReadonlySet<unknown> = new Set(['shopping', 'tasks']);

const HOUSEHOLD_QUERIES: ReadonlySet<unknown> = new Set([
  'shopping',
  'shopping-history',
  'shopping-resolved',
  'members',
  'tasks',
  'license',
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
 * The cached households the user no longer belongs to, once their households are known: every
 * cached one that is not in the list. With several households (bloque 12) the others are not
 * ended: their data and their queues stay, whichever one the phone shows.
 */
export function endedHouseholdIds(
  cached: readonly string[],
  households: readonly { householdId: string }[] | undefined,
): string[] {
  if (households === undefined) return [];
  return cached.filter((id) => !households.some((h) => h.householdId === id));
}

/** Per household, the queued changes the server refused because the person was no longer in it. */
const refused = new Map<string, number>();

/**
 * A queued change of `householdId` was refused because the person is no longer in it
 * (`householdGone`): it counts among what the household's notice says was lost, with the changes
 * still waiting (prueba del 4 de noviembre: of two, the first reached the server before the
 * household was forgotten, and the notice said «Se perdió 1»).
 */
export function noteRefusedByEnded(householdId: unknown): void {
  if (typeof householdId !== 'string') return;
  refused.set(householdId, (refused.get(householdId) ?? 0) + 1);
}

/** How many changes of `householdId` were refused that way, and forget them. */
export function takeRefusedByEnded(householdId: string): number {
  const count = refused.get(householdId) ?? 0;
  refused.delete(householdId);
  return count;
}
