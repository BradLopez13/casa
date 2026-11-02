// Pure: no react-native import, so Vitest can check it.
import { onlineManager } from '@tanstack/react-query';
import { isTransient, toAppError, type AppError } from '@/data/supabase/errors';
import { isSignedIn } from './sessionUser';

/**
 * The longest wait between two tries of a change that has not reached the server: short enough
 * that «Reintentar» (`QueueBand`) is answered in seconds, not a minute (bloque 13).
 */
export const NETWORK_RETRY_MAX_MS = 15_000;

/** For this long after the connection comes back, a failed try is tried again every second. */
export const RECONNECT_WINDOW_MS = 60_000;
export const RECONNECT_RETRY_MS = 1000;

let onlineSince = -Infinity;

/**
 * The connection came back (or the person asked to try again): the next tries go every second.
 * «Online» comes before the internet does (`isInternetReachable` still unknown), so the first
 * tries fail, and the doubling waits used to add up to 30–40 s before the queue went (bloque 13,
 * P3-1). Starting the window over is the same as starting the count again.
 */
export function markOnline(now = Date.now()): void {
  onlineSince = now;
  retryQueuedNow();
}

/**
 * How many tries a change that never reached the server gets: a week at a try every 15 s, the same
 * week the server trusts the time of a tap queued offline (`complete_task`'s `p_at`).
 */
export const NETWORK_RETRY_LIMIT = (7 * 24 * 60 * 60_000) / NETWORK_RETRY_MAX_MS;

/**
 * A queued change that never reached the server is retried for up to a week (retries pause while
 * offline, so a phone without a connection waits as long as it takes), at a try every 15 s at most. A connection that hangs
 * without failing (a captive portal, a weak signal in the supermarket) used to spend ten tries in
 * about five minutes and drop the change (bloque 11, T1); a week keeps it, and still frees the
 * queue behind it if one request never gets through. An answer from a server that could not
 * answer (5xx, 429, a token mid-refresh, a serialization clash: `isTransient`) is tried again
 * the same way (bloque 13, P2-2); any other answer from the server is final.
 */
export const retryOnNetwork = (failureCount: number, error: AppError) => {
  const appError = toAppError(error);
  const again = failureCount < NETWORK_RETRY_LIMIT && isTransient(appError, isSignedIn());
  // The token expired and could not be refreshed: ask for a new one before the next try (T1).
  if (again && appError.status === 401) refreshSoon();
  return again;
};

/** How the session is refreshed (`supabase.auth.refreshSession`, set by the root layout). */
let refreshSession: () => void = () => undefined;
let refreshedAt = -Infinity;
/** At most one refresh every 5 s, whatever the number of changes waiting. */
export const SESSION_REFRESH_MS = 5000;

export function refreshSessionWith(refresh: () => void): void {
  refreshSession = refresh;
}

function refreshSoon(now = Date.now()): void {
  if (now - refreshedAt < SESSION_REFRESH_MS) return;
  refreshedAt = now;
  refreshSession();
}

/**
 * Each try waits twice as long as the last, from 1 s up to 15 s; for a minute after the connection
 * comes back, every second (`markOnline`).
 */
export const retryDelayOnNetwork = (failureCount: number, _error?: unknown, now = Date.now()) =>
  now - onlineSince < RECONNECT_WINDOW_MS
    ? RECONNECT_RETRY_MS
    : Math.min(1000 * 2 ** failureCount, NETWORK_RETRY_MAX_MS);

/** A failed load is tried once more, and not at all without a connection (fase 10e). */
export const retryOnceOnline = (failureCount: number) =>
  failureCount < 1 && onlineManager.isOnline();

/**
 * A list kept on the device (the shopping, the tasks) loads offline first: a load is tried even
 * while offline (the connection state can lag), and an offline failure is final at once instead of
 * waiting for the connection. The cached list stays on screen with the offline band; with nothing
 * cached the screen shows its error and its retry. Back online, the reconnect refetches it. The
 * app's default ('always') would retry offline too; 'online' would leave a list never loaded
 * spinning until the connection is back.
 */
export const offlineFirstQueryOptions = {
  networkMode: 'offlineFirst',
  retry: retryOnceOnline,
} as const;

/** The waits of the queued changes between two tries, each with the way to cut it short. */
const waits = new Set<() => void>();

/**
 * Cuts short every wait between two tries of a queued change: they try again now. «Reintentar»
 * (`QueueBand`) and the connection coming back (`markOnline`) call it (bloque 14.1, T5).
 */
export function retryQueuedNow(): void {
  for (const wake of [...waits]) wake();
}

/**
 * How many times each run of a change has been tried and when its last try ended, by the context
 * TanStack gives its function: one object per run (`execute`), the same on every retry of it.
 */
const tries = new WeakMap<object, { count: number; endedAt: number }>();

/**
 * A queued change's function, with the wait between two tries inside it instead of in TanStack's
 * `retryDelay` (which the queued changes set to 0): TanStack's timer cannot be cut short, and
 * «Reintentar» waited for it, up to 15 s (bloque 14.1, T5). The first try goes at once; each next
 * one waits what is left of `retryDelayOnNetwork` since the last try ended (a pause in between,
 * offline or in the background, counts), or less if `retryQueuedNow` comes first. A change
 * restored after a restart is a new run and starts over.
 */
export function queuedFn<V, R>(fn: (vars: V) => Promise<R>): (vars: V, run?: object) => Promise<R> {
  return async (vars, run) => {
    if (run === undefined) return fn(vars);
    const before = tries.get(run);
    if (before !== undefined) {
      const left = retryDelayOnNetwork(before.count - 1) - (Date.now() - before.endedAt);
      if (left > 0) await waitBetweenTries(left);
    }
    try {
      return await fn(vars);
    } finally {
      tries.set(run, { count: (before?.count ?? 0) + 1, endedAt: Date.now() });
    }
  };
}

/** The retry delay TanStack keeps for the queued changes: none, the wait is in `queuedFn`. */
export const QUEUED_RETRY_DELAY = 0;

function waitBetweenTries(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const wake = () => {
      clearTimeout(timer);
      waits.delete(wake);
      resolve();
    };
    const timer = setTimeout(wake, ms);
    waits.add(wake);
  });
}
