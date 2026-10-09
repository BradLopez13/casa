import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { REALTIME_SUBSCRIBE_STATES, type RealtimeChannel } from '@supabase/supabase-js';
import { useEffect } from 'react';
import { supabase } from '@/data/supabase/client';
import { createInvalidationBatcher } from './invalidations';

const BATCH_DELAY_MS = 300;

// supabase.channel() hands back an existing channel with the same topic, and a removed
// channel only leaves that list once the server acknowledges the leave. A remount on the
// same household waits for the previous removal so it never reuses a closing channel.
let previousRemoval: Promise<unknown> = Promise.resolve();

/**
 * Listens to the household's private broadcast channel and refreshes the affected queries.
 * Closes the channel on unmount (sign-out unmounts the tabs) and when the household changes.
 */
export function useHouseholdChannel(householdId: string | undefined): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (householdId === undefined) return;

    // A key with its own mutation in flight would overwrite the optimistic state; the
    // mutation refreshes it when it settles.
    const isBusy = (key: QueryKey) => {
      if (key[0] === 'tasks')
        return queryClient.isMutating({ mutationKey: ['tasks', 'toggle'] }) > 0;
      if (key[0] === 'shopping') return queryClient.isMutating({ mutationKey: ['shopping'] }) > 0;
      return false;
    };
    const batcher = createInvalidationBatcher({
      delayMs: BATCH_DELAY_MS,
      isBusy,
      invalidate: (queryKey) => void queryClient.invalidateQueries({ queryKey }),
      setTimer: setTimeout,
      clearTimer: clearTimeout,
    });

    let cancelled = false;
    let lostConnection = false;
    let channel: RealtimeChannel | undefined;

    const opened = Promise.all([
      previousRemoval,
      // The channel is private: the socket must carry the user's JWT before joining.
      // supabase-js keeps it current afterwards (it calls setAuth on TOKEN_REFRESHED).
      supabase.realtime.setAuth().catch(() => undefined),
    ]).then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(`household:${householdId}`, { config: { private: true } })
        .on('broadcast', { event: 'changed' }, ({ payload }: { payload?: unknown }) => {
          const table = (payload as { table?: unknown } | undefined)?.table;
          if (typeof table === 'string') batcher.push(table);
        })
        .subscribe((status) => {
          if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
            // Broadcasts sent while we were away are lost: refetch everything once.
            if (lostConnection) batcher.flushAll();
            lostConnection = false;
          } else {
            lostConnection = true;
          }
        });
    });

    return () => {
      cancelled = true;
      batcher.dispose();
      previousRemoval = opened.then(() =>
        channel ? supabase.removeChannel(channel).catch(() => undefined) : undefined,
      );
    };
  }, [householdId, queryClient]);
}
