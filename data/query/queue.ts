// Pure: no react-native import, so Vitest can check it.

/**
 * Whether a mutation touches a household: its queue or its variables say so; one that names none
 * (an edit by id) counts, rather than refetch over its change. Every household, without one.
 */
export function touches(
  m: { options: { scope?: { id: string } }; state: { variables?: unknown } },
  householdId: string | undefined,
): boolean {
  if (householdId === undefined) return true;
  const scope = m.options.scope?.id;
  if (scope !== undefined && scope.includes(':')) return scope.endsWith(`:${householdId}`);
  const named = (m.state.variables as { householdId?: unknown } | undefined)?.householdId;
  return typeof named !== 'string' || named === householdId;
}

/** Marks a queued mutation (kept on the device, sent when it can): Sentry reports its drop. */
export const QUEUED_META = { queued: true } as const;
