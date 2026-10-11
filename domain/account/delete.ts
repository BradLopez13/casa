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
