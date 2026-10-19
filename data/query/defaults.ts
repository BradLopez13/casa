import type { DefaultOptions } from '@tanstack/react-query';

/**
 * A load stays fresh for a minute, so returning to the app or to a tab does not refetch it: the
 * household channel refreshes whatever another member changes, a reconnection refreshes
 * everything once, and each mutation refreshes what it touched. Reads that must reach the
 * server (accepting an invite) ask for staleTime 0.
 */
const STALE_TIME_MS = 60_000;

/**
 * The app's query and mutation defaults. Offline, everything fails fast with NETWORK and shows
 * its error, as before the connection was tracked: only shopping opts into waiting for it (its
 * list and history, and the queue of adds and boughts).
 */
export const appQueryDefaults: DefaultOptions = {
  queries: { retry: 1, networkMode: 'always', staleTime: STALE_TIME_MS },
  mutations: { networkMode: 'always' },
};
