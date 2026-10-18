import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect } from 'react';
import { supabase } from '@/data/supabase/client';
import { openHouseholdChannel, type ChannelClient } from './householdChannel';
import { createInvalidationBatcher } from './invalidations';

const BATCH_DELAY_MS = 300;

const client: ChannelClient<RealtimeChannel> = {
  // With no token, setAuth takes the current session's; supabase-js keeps it current
  // afterwards (it calls setAuth on TOKEN_REFRESHED).
  setAuth: () => supabase.realtime.setAuth(),
  open: (topic, onChange, onStatus) =>
    supabase
      .channel(topic, { config: { private: true } })
      .on('broadcast', { event: 'changed' }, ({ payload }: { payload?: unknown }) =>
        onChange(payload),
      )
      .subscribe((status) => onStatus(status)),
  remove: (channel) => supabase.removeChannel(channel),
  teardown: (channel) => channel.teardown(),
  isListed: (topic) => supabase.getChannels().some((c) => c.topic === `realtime:${topic}`),
  // realtime-js only drops a channel from its list on close; after a failed leave the
  // internal `_remove` is the only way to stop channel() handing back the dead one.
  forget: (channel) => {
    const realtime = supabase.realtime as unknown as {
      _remove?: (channel: RealtimeChannel) => void;
    };
    realtime._remove?.call(supabase.realtime, channel);
  },
};

// A remount waits for the previous channel to be removed: supabase.channel() would
// otherwise hand back the one still closing. The chain never rejects.
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
    const channel = openHouseholdChannel({
      householdId,
      client,
      batcher,
      after: previousRemoval,
      setTimer: setTimeout,
      clearTimer: clearTimeout,
    });

    return () => {
      batcher.dispose();
      previousRemoval = channel.stop();
    };
  }, [householdId, queryClient]);
}
