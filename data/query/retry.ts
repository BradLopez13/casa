// Pure: no react-native import, so Vitest can check it.
import { onlineManager } from '@tanstack/react-query';
import { toAppError, type AppError } from '@/data/supabase/errors';

/** The longest wait between two tries of a change that has not reached the server. */
export const NETWORK_RETRY_MAX_MS = 60_000;

/**
 * A queued change that never reached the server is retried for as long as it takes (retries pause
 * while offline). A connection that hangs without failing (a captive portal, a weak signal in the
 * supermarket) used to spend ten tries in about five minutes and drop the change (bloque 11, T1):
 * a change waits in its queue, and the ones behind it wait with it, rather than being lost. Any
 * answer from the server is final, so only the network keeps a change alive.
 */
export const retryOnNetwork = (_failureCount: number, error: AppError) =>
  toAppError(error).code === 'NETWORK';

/** Each try waits twice as long as the last, from 1 s up to a minute. */
export const retryDelayOnNetwork = (failureCount: number) =>
  Math.min(1000 * 2 ** failureCount, NETWORK_RETRY_MAX_MS);

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
