export type Member = { userId: string };

/** The signed-in owner is the only active member: deleting the account deletes the household. */
export function isOwnerAlone(
  role: string | undefined,
  members: readonly Member[] | undefined,
  userId: string | null | undefined,
): boolean {
  return role === 'owner' && !!userId && members?.length === 1 && members[0]?.userId === userId;
}

export type DeleteFailure = 'transfer' | 'unknown';

/** OWNER_MUST_TRANSFER has its own guidance; anything else gets the generic message. */
export function deleteFailureKind(code: string): DeleteFailure {
  return code === 'OWNER_MUST_TRANSFER' ? 'transfer' : 'unknown';
}

/**
 * The households OWNER_MUST_TRANSFER names, from the JSON array the server puts in the error's
 * detail (bloque 12); none when it does not name them (a server before bloque 12, a race).
 */
export function transferNames(detail: string | undefined): string[] {
  if (!detail) return [];
  try {
    const parsed: unknown = JSON.parse(detail);
    return Array.isArray(parsed) ? parsed.filter((n): n is string => typeof n === 'string') : [];
  } catch {
    return [];
  }
}
