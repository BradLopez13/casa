import type { DefaultOptions } from '@tanstack/react-query';

/**
 * The app's query and mutation defaults. Offline, everything fails fast with NETWORK and shows
 * its error, as before the connection was tracked: only shopping opts into waiting for it (its
 * list and history, and the queue of adds and boughts).
 */
export const appQueryDefaults: DefaultOptions = {
  queries: { retry: 1, networkMode: 'always' },
  mutations: { networkMode: 'always' },
};
