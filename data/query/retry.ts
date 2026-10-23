// Pure: no react-native import, so Vitest can check it.
import { onlineManager } from '@tanstack/react-query';
import { toAppError, type AppError } from '@/data/supabase/errors';

/** How many times a queued change is resent when the request never reached the server. */
export const NETWORK_RETRIES = 10;

/**
 * A request that never reached the server is retried (retries pause while offline), with the
 * default backoff capped at 30 s. The cap keeps one stuck change from holding its queue, and with
 * it every later change, forever. Any other error is final.
 */
export const retryOnNetwork = (failureCount: number, error: AppError) =>
  failureCount < NETWORK_RETRIES && toAppError(error).code === 'NETWORK';

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
