import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import Constants from 'expo-constants';
import { useState, type ReactNode } from 'react';
import { persister } from '@/data/query/persist';
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
  if (status === 'loading') return null;
  const buster = persistBuster(appVersion, userId);
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
        void resumeQueues(queryClient);
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
