export type StaleBandInput = {
  /** The task list has cached data to show. */
  hasData: boolean;
  /** The last refresh failed while cached data was showing. */
  isRefetchError: boolean;
  /** That failure was a lack of network, not a server or permission error. */
  errorIsNetwork: boolean;
};

/**
 * Whether Hoy and Tareas say they are showing the last tasks they got: only with cached tasks
 * (without them the list shows its own error and Retry), and either offline or right after a
 * refresh that could not reach the server (a Wi-Fi with no internet looks online).
 */
export function shouldShowStaleBand(q: StaleBandInput, online: boolean): boolean {
  return q.hasData && (!online || (q.isRefetchError && q.errorIsNetwork));
}
