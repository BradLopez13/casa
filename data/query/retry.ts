// Pure: no react-native import, so Vitest can check it.
import { onlineManager } from '@tanstack/react-query';
import { toAppError, type AppError } from '@/data/supabase/errors';

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
 * queue behind it if one request never gets through. Any answer from the server is final.
 */
export const retryOnNetwork = (failureCount: number, error: AppError) =>
  failureCount < NETWORK_RETRY_LIMIT && toAppError(error).code === 'NETWORK';

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
