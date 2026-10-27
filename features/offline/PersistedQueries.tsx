import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import Constants from 'expo-constants';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { persister, saveCacheNow } from '@/data/query/persist';
import { PERSIST_MAX_AGE_MS, queryClient } from '@/data/query/setup';
import { useSession } from '@/features/auth/SessionProvider';
import {
  addKey,
  boughtKey,
  buildShoppingMutationDefaults,
  quantityKey,
} from '@/features/shopping/offline';
import { buildCreateOptions, CREATE_KEY } from '@/features/tasks/create';
import { buildToggleOptions, TOGGLE_KEY } from '@/features/tasks/toggle';
import { useNotice } from '@/ui/components/Notice';
import { persistBuster, persistDehydrateOptions, resumeQueues } from './persistence';
import { restoreQueue, saveQueue, savingQueueOf, startSavingQueue } from './queueStore';

/** A burst of taps is saved once, right after it: soon enough for a phone put away at once. */
const QUEUE_SAVE_MS = 50;

const appVersion = Constants.expoConfig?.version ?? '0';

/**
 * Restores the shopping list, the tasks and their offline queues, and keeps them on the device.
 * It waits for the session (the splash stays up) because the persisted cache belongs to one user:
 * a cache saved under someone else is discarded. A change of user remounts it, so from then on
 * the cache is saved under the new user.
 */
export function PersistedQueries({ children }: { children: ReactNode }) {
  const notify = useNotice();
  const { status, userId } = useSession();
  // The queued mutations' functions must be registered before the cache is restored. The
  // notice is reachable from here, so the defaults use it directly.
  useState(() => {
    const shopping = buildShoppingMutationDefaults(queryClient, notify);
    queryClient.setMutationDefaults(addKey, shopping.add);
    queryClient.setMutationDefaults(boughtKey, shopping.bought);
    queryClient.setMutationDefaults(quantityKey, shopping.quantity);
    queryClient.setMutationDefaults(TOGGLE_KEY, buildToggleOptions(queryClient, notify));
    queryClient.setMutationDefaults(CREATE_KEY, buildCreateOptions(queryClient, notify));
    return null;
  });
  const buster = persistBuster(appVersion, userId);
  // Leaving the app saves at once: the throttled save could come after the app is gone. Only once
  // restored: saving the empty cache of a restore still under way would wipe what is on the device.
  const restored = useRef<string | null>(null);
  useEffect(() => {
    if (status === 'loading') return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && restored.current === buster) {
        void saveCacheNow(queryClient, buster, persistDehydrateOptions);
      }
      if (state !== 'active' && userId && savingQueueOf(userId)) {
        void saveQueue(queryClient, userId).catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [status, buster, userId]);
  // The queue is saved on its own, at every change, not with the throttled cache (bloque 13).
  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = queryClient.getMutationCache().subscribe(() => {
      if (!savingQueueOf(userId)) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (savingQueueOf(userId)) void saveQueue(queryClient, userId).catch(() => undefined);
      }, QUEUE_SAVE_MS);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [userId]);
  if (status === 'loading') return null;
  return (
    <PersistQueryClientProvider
      key={buster}
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: PERSIST_MAX_AGE_MS,
        buster,
        dehydrateOptions: persistDehydrateOptions,
      }}
      // Not awaited: the provider stays in its restoring state until onSuccess settles, and the
      // queues may take as long as the connection does.
      onSuccess={() => {
        restored.current = buster;
        // The person's queue comes back from its own key (and an older build's from the cache),
        // whatever happened to the cache, and goes on.
        void (async () => {
          if (userId) {
            await restoreQueue(queryClient, userId).catch(() => 0);
            startSavingQueue(userId);
          }
          await resumeQueues(queryClient);
        })();
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
