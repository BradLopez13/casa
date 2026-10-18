import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

const subscribeOnline = (onChange: () => void) => onlineManager.subscribe(onChange);
const isOnline = () => onlineManager.isOnline();

/** Whether the phone has a connection, as the root layout feeds it to TanStack Query. */
export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, isOnline);
}
