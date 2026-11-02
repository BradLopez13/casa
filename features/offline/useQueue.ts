import { focusManager, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { shouldPersistMutation } from './persistence';
import { createQueueMonitor, type QueueMonitor, type QueueSnapshot } from './queueMonitor';

type Held = { monitor: QueueMonitor; users: number; stop: (() => void) | null };

const monitors = new WeakMap<QueryClient, Held>();

function held(queryClient: QueryClient): Held {
  let entry = monitors.get(queryClient);
  if (!entry) {
    entry = {
      monitor: createQueueMonitor(queryClient, shouldPersistMutation, Date.now, () =>
        Platform.OS === 'web' ? focusManager.isFocused() : AppState.currentState === 'active',
      ),
      users: 0,
      stop: null,
    };
    monitors.set(queryClient, entry);
  }
  return entry;
}

function hold(entry: Held): () => void {
  entry.users++;
  entry.stop ??= entry.monitor.start();
  return () => {
    entry.users--;
    if (entry.users === 0) {
      entry.stop?.();
      entry.stop = null;
    }
  };
}

/** The queue monitor of this client (`queueMonitor`). */
export const queueMonitorOf = (queryClient: QueryClient): QueueMonitor => held(queryClient).monitor;

/**
 * Keeps the app's queue watched for as long as the app runs, whatever screen is up: the root
 * layout calls it once (bloque 14.1).
 */
export function keepQueueWatched(queryClient: QueryClient): () => void {
  return hold(held(queryClient));
}

/** What the queue says now: the ids waiting («Sin enviar») and the band, kept up to date. */
export function useQueueSnapshot(): QueueSnapshot {
  const entry = held(useQueryClient());
  // Stable, so React does not subscribe again on every render of every note.
  const subscribe = useCallback(
    (listener: () => void) => {
      const release = hold(entry);
      const off = entry.monitor.subscribe(listener);
      return () => {
        off();
        release();
      };
    },
    [entry],
  );
  return useSyncExternalStore(subscribe, entry.monitor.getSnapshot);
}
