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
import { reportQueryError as report } from './report';
import { markOnline, setQueueWaiter } from './retry';
import { queueLog, queueLogOn, startQueueLog } from './queueLog';
import { backgroundWait } from '@/modules/background-wait';

export { reportQueryErrorsTo, reportQueueStorage } from './report';

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
  // Behind, Android fires no JS timer: the queue waits between two tries on a native one
  // (bloque 15.1, `modules/background-wait`).
  if (backgroundWait !== null) setQueueWaiter(backgroundWait);
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
