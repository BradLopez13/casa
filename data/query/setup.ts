import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';
import { appQueryDefaults } from './defaults';
import { markOnline } from './retry';

/** The app's one query client. */
export const queryClient = new QueryClient({ defaultOptions: appQueryDefaults });

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
  if (Platform.OS === 'web') return;
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (state) => {
      handleFocus(state === 'active');
    });
    return () => subscription.remove();
  });
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(state.isConnected === true && state.isInternetReachable !== false);
    }),
  );
}
