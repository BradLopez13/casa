import NetInfo from '@react-native-community/netinfo';
import {
  focusManager,
  MutationCache,
  onlineManager,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';
import { appQueryDefaults } from './defaults';
import { errorReport, type ErrorReport } from '@/data/telemetry/queryErrors';
import { markOnline } from './retry';
import { queueLog, queueLogOn, startQueueLog } from './queueLog';

type Reporter = (error: unknown, report: ErrorReport) => void;
let reporter: Reporter = () => undefined;

/**
 * Where a failed query or mutation worth knowing about goes (Sentry, from the root layout):
 * unknown answers and queued changes the queue dropped (bloque 13, T-2; `errorReport`).
 */
export function reportQueryErrorsTo(next: Reporter): void {
  reporter = next;
}

function report(error: unknown, key: readonly unknown[] | undefined, queued: boolean): void {
  const found = errorReport(error, { key, queued });
  if (found) reporter(error, found);
}

/**
 * Saving or restoring the offline queue on the device failed (bloque 14.4, T3: a full disk, a
 * broken write): Sentry hears it, with the step and nothing of what was queued.
 */
export function reportQueueStorage(error: unknown, step: 'save' | 'restore'): void {
  reporter(error, {
    key: `queue/${step}`,
    code: 'QUEUE_STORAGE',
    status: undefined,
    serverCode: undefined,
    queued: true,
  });
}

/** The app's one query client. A queued mutation says so in its meta (`QUEUED_META`). */
export const queryClient = new QueryClient({
  defaultOptions: appQueryDefaults,
  queryCache: new QueryCache({ onError: (error, query) => report(error, query.queryKey, false) }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) =>
      report(error, mutation.options.mutationKey, mutation.meta?.queued === true),
  }),
});

/** How long a cache kept on the device is good for. */
export const PERSIST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Ties TanStack Query to the phone: stale queries refetch when the app returns to the foreground,
 * and the connection is tracked, so the queues (shopping, tasks) pause while offline and resume
 * when it is back, and the offline band shows. On the web the default listeners (the browser's
 * focus, online and offline events) already do this.
 */
export function watchAppAndConnection(): void {
  // Back online, the queue tries every second for a while (bloque 13, P3-1).
  onlineManager.subscribe((online) => {
    if (online) markOnline();
  });
  if (queueLogOn) startQueueLog(queryClient);
  if (Platform.OS === 'web') return;
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (state) => {
      handleFocus(state === 'active');
    });
    return () => subscription.remove();
  });
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      if (queueLogOn) {
        queueLog(`netinfo connected=${state.isConnected} reachable=${state.isInternetReachable}`);
      }
      setOnline(state.isConnected === true && state.isInternetReachable !== false);
    }),
  );
}
