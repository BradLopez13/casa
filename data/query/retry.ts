// Pure: no react-native import, so Vitest can check it.
import { onlineManager } from '@tanstack/react-query';
import { AppError, isTransient, toAppError } from '@/data/supabase/errors';
import { queueLog, queueLogOn } from './queueLog';
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
  if (again && (appError.status === 401 || appError.code === 'NOT_AUTHENTICATED')) refreshSoon();
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
 * A queued change's function, with the tries inside it instead of in TanStack. Two reasons:
 * TanStack's timer between two tries cannot be cut short, and «Reintentar» waited for it, up to
 * 15 s (bloque 14.1, T5); and with the app behind, Android delivers the network's events and the
 * answers to JS but fires no JS timer at all (React Native stops them on host pause,
 * `JavaTimerManager.onHostPause`), and TanStack sleeps on one before every retry, so a change whose
 * first try failed as the connection came back (the handover from mobile data to wifi: ciclo 17
 * en el .51, 4 de noviembre) waited for the app to be opened (bloque 15.1). Here a transient
 * failure (`retryOnNetwork`) waits what `retryDelayOnNetwork` says with the waiter the app set
 * (`setQueueWaiter`: native on Android, so it runs behind), then for the connection if it went,
 * and tries again; «Reintentar» and the connection coming back cut both waits short
 * (`retryQueuedNow`). Any answer from the server is final at once. TanStack keeps no retry of its
 * own (`QUEUED_RETRY`). A change restored after a restart is a new run and starts over, with what
 * is left of its wait since the last try ended (a pause in between, offline or behind, counts).
 */
export function queuedFn<V, R>(fn: (vars: V) => Promise<R>): (vars: V, run?: object) => Promise<R> {
  return async (vars, run) => {
    // Taken out of the cache (a household left, a sign-out): it never goes again (T6), also when
    // that happened while it waited.
    const letGo = () => typeof vars === 'object' && vars !== null && abandoned.has(vars);
    if (letGo()) throw new AppError('QUEUE_DROPPED');
    if (run === undefined) return fn(vars);
    const before = tries.get(run);
    let count = before?.count ?? 0;
    if (before !== undefined) {
      const left = retryDelayOnNetwork(count - 1) - (Date.now() - before.endedAt);
      if (left > 0) await waitBetweenTries(left);
      if (letGo()) throw new AppError('QUEUE_DROPPED');
    }
    for (;;) {
      try {
        const result = await fn(vars);
        tries.set(run, { count: count + 1, endedAt: Date.now() });
        return result;
      } catch (error) {
        tries.set(run, { count: count + 1, endedAt: Date.now() });
        const appError = toAppError(error);
        if (!retryOnNetwork(count, appError)) throw error;
        count += 1;
        const wait = retryDelayOnNetwork(count - 1);
        if (queueLogOn) queueLog(`try ${count} failed ${appError.code}: again in ${wait} ms`);
        park(vars, true);
        try {
          await waitBetweenTries(wait);
          if (letGo()) throw new AppError('QUEUE_DROPPED');
          await untilOnline();
          if (letGo()) throw new AppError('QUEUE_DROPPED');
        } finally {
          park(vars, false);
        }
      }
    }
  };
}

/** The variables of the queued changes taken out of the cache: TanStack keeps retrying them. */
const abandoned = new WeakSet<object>();

/**
 * A queued change is taken out of the cache (bloque 14.4, T6): removing it does not stop the tries
 * TanStack already has under way, so its function would go to the server again (after leaving a
 * household, with NOT_A_MEMBER and its notice). From now on it fails as dropped, which says
 * nothing and reports nothing (`droppedOnSignOut`). Call it before `remove` or `clear`.
 */
export function abandonQueued(mutation: { state: { variables?: unknown } }): void {
  const vars = mutation.state.variables;
  if (typeof vars === 'object' && vars !== null) abandoned.add(vars);
}

/** The variables of the queued changes waiting inside `queuedFn` (between tries or for the connection). */
const parked = new Set<object>();
const parkedListeners = new Set<() => void>();
let parkedVersion = 0;

function park(vars: unknown, on: boolean): void {
  if (typeof vars !== 'object' || vars === null) return;
  if (on) parked.add(vars);
  else parked.delete(vars);
  parkedVersion += 1;
  for (const listener of [...parkedListeners]) listener();
}

/**
 * Whether a queued change waits inside `queuedFn`, between two tries or for the connection: like
 * a change TanStack paused, it is not on its way (revisión 15.1: with the tries out of TanStack,
 * `isPaused` stays false while a change waits for the connection after a failed try, so a toggle
 * kept its note busy offline and a delete in Compra waited 10 s for it).
 */
export function isParked(vars: unknown): boolean {
  return typeof vars === 'object' && vars !== null && parked.has(vars);
}

/** Called whenever a queued change parks or goes on (for `useSyncExternalStore`). */
export function subscribeParked(listener: () => void): () => void {
  parkedListeners.add(listener);
  return () => parkedListeners.delete(listener);
}

/** Changes on every park and unpark: the snapshot for `useSyncExternalStore`. */
export const parkedSnapshot = (): number => parkedVersion;

/** The retry TanStack keeps for the queued changes: none, the tries are in `queuedFn`. */
export const QUEUED_RETRY = false;

type Waiter = (ms: number) => Promise<void>;
let waiter: Waiter | undefined;

/**
 * How a queued change waits between two tries: a JS timer unless the app sets one that runs with
 * the app behind (on Android, the native `BackgroundWait`, `data/query/setup.ts`). `undefined` goes
 * back to the timer.
 */
export function setQueueWaiter(wait: Waiter | undefined): void {
  waiter = wait;
}

function waitBetweenTries(ms: number): Promise<void> {
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wake = () => {
      if (timer !== undefined) clearTimeout(timer);
      waits.delete(wake);
      resolve();
    };
    // A waiter that fails (the native module gone with a reload) falls back to the timer: the
    // change waits, it is never dropped for it (revisión 15.1).
    let native: Promise<void> | undefined;
    try {
      native = waiter?.(ms);
    } catch {
      native = undefined;
    }
    if (native === undefined) timer = setTimeout(wake, ms);
    else void native.then(wake, () => (timer = setTimeout(wake, ms)));
    waits.add(wake);
  });
}

/** Resolves once there is a connection (at once with one); «Reintentar» cuts it short too. */
function untilOnline(): Promise<void> {
  if (onlineManager.isOnline()) return Promise.resolve();
  return new Promise((resolve) => {
    const wake = () => {
      off();
      waits.delete(wake);
      resolve();
    };
    const off = onlineManager.subscribe((online) => {
      if (online) wake();
    });
    waits.add(wake);
  });
}
