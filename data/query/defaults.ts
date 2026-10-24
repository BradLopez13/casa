import type { DefaultOptions } from '@tanstack/react-query';
import { retryOnceOnline } from './retry';

/**
 * A load stays fresh for a minute, so returning to the app or to a tab does not refetch it: the
 * household channel refreshes whatever another member changes, a reconnection refreshes
 * everything once, and each mutation refreshes what it touched. Reads that must reach the
 * server (accepting an invite) ask for staleTime 0.
 */
const STALE_TIME_MS = 60_000;

/**
 * The app's query and mutation defaults. Offline, everything fails fast with NETWORK and shows
 * its error, and a failed load is not tried again without a connection: with a slow one, a retry
 * after a 15 s timeout doubled the wait (fase 10e). The lists kept on the device (shopping, tasks)
 * load offline first, and their queues wait for the connection.
 */
export const appQueryDefaults: DefaultOptions = {
  queries: { retry: retryOnceOnline, networkMode: 'always', staleTime: STALE_TIME_MS },
  mutations: { networkMode: 'always' },
};
