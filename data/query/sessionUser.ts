// Pure: no react-native import, so Vitest can check it.
import { AppError, toAppError } from '@/data/supabase/errors';

/** Who is signed in on this phone: undefined until the session is read, null when nobody. */
let current: string | null | undefined;

/** Kept by `SessionProvider` on every change of session. */
export function setSessionUser(userId: string | null | undefined): void {
  current = userId;
}

/**
 * A queued change goes as the person who made it, or not at all. Retries outlive a sign-out
 * (clearing the cache does not stop them), and a change made by one person must never reach the
 * server with the next one's session (bloque 11). While the session is still unknown (a cold
 * start resuming the queue) it goes: the cache it came from belongs to that same person.
 */
export function assertQueuedBy(userId: string | null | undefined): void {
  if (userId == null || current === undefined) return;
  if (current !== userId) throw new AppError('NOT_AUTHENTICATED');
}

/** The change was dropped because its person signed out: nothing to roll back or say. */
export function droppedOnSignOut(error: unknown): boolean {
  return toAppError(error).code === 'NOT_AUTHENTICATED';
}
