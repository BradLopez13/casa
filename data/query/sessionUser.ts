// Pure: no react-native import, so Vitest can check it.
import { AppError, toAppError } from '@/data/supabase/errors';

/** Who is signed in on this phone: undefined until the session is read, null when nobody. */
let current: string | null | undefined;

/** Kept by `SessionProvider` on every change of session. */
export function setSessionUser(userId: string | null | undefined): void {
  current = userId;
}

/** How long an asked sign-out waits for its SIGNED_OUT: a failed one must not mark a later one. */
const SIGNING_OUT_MS = 30_000;
let signingOutAt = -Infinity;

/** The person asked to sign out (Ajustes, deleting the account): the SIGNED_OUT that follows is theirs. */
export function markSigningOut(now = Date.now()): void {
  signingOutAt = now;
}

/** Whether the sign-out just seen was asked for (in the last 30 s); asking again starts over. */
export function consumeSigningOut(now = Date.now()): boolean {
  const asked = now - signingOutAt < SIGNING_OUT_MS;
  signingOutAt = -Infinity;
  return asked;
}

/** Whether someone is signed in, as far as the app knows: unknown at a cold start counts as yes. */
export function isSignedIn(): boolean {
  return current !== null;
}

/**
 * A queued change goes as the person who made it, or not at all. Retries outlive a sign-out
 * (clearing the cache does not stop them), and a change made by one person must never reach the
 * server with the next one's session (bloque 11). While the session is still unknown (a cold
 * start resuming the queue) it goes: the cache it came from belongs to that same person.
 */
export function assertQueuedBy(userId: string | null | undefined): void {
  if (userId == null || current === undefined) return;
  if (current !== userId) throw new AppError('QUEUE_DROPPED');
}

/**
 * The change was let go on this phone (its person signed out, its household was left): nothing
 * to roll back or say. A NOT_AUTHENTICATED the server answered is not this (bloque 15.1, P2-6):
 * with someone signed in it is tried again, and final only once nobody is.
 */
export function droppedOnSignOut(error: unknown): boolean {
  return toAppError(error).code === 'QUEUE_DROPPED';
}

/**
 * The server refused a queued change because the person is no longer in its household (deleted,
 * removed, left from another phone): the change is rolled back, and the household's own notice
 * says what happened and how many changes were lost (`useForgetEndedHousehold`), so the change
 * says nothing of its own (prueba del 4 de noviembre: «Ya no estás en esta casa.» came first).
 */
export function householdGone(error: unknown): boolean {
  return toAppError(error).code === 'NOT_A_MEMBER';
}
