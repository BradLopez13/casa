import type { QueryClient } from '@tanstack/react-query';
import { forgetCachedData } from '@/data/query/persist';
import {
  countStoredQueue,
  forgetQueue,
  saveQueue,
  stopSavingQueue,
} from '@/features/offline/queueStore';
import { releasePushLocally } from '@/features/push/registration';
import { t } from '@/i18n';

/**
 * After any sign-out the next person never sees this one's data, here or on the device. Asked for
 * (Ajustes, deleting the account), the queue goes too: the person was told what it costs. Not
 * asked for (a session revoked, the password changed elsewhere), the person's queue stays under
 * their own key and goes on when they sign back in (`assertQueuedBy` keeps it from going as
 * anyone else); the app says so, and the phone stops getting their notices, as no session is left
 * to tell the server (bloque 13, P2-3).
 */
export async function handleSignedOut({
  queryClient,
  previous,
  voluntary,
  notify,
}: {
  queryClient: QueryClient;
  previous: string | null;
  voluntary: boolean;
  notify: (message: string) => void;
}): Promise<void> {
  stopSavingQueue();
  if (voluntary) {
    forgetCachedData(queryClient);
    if (previous) await forgetQueue(previous);
    return;
  }
  // Taken from the cache before it is cleared: the last tap may not have been saved yet.
  const kept = previous ? saveQueue(queryClient, previous).catch(() => undefined) : undefined;
  forgetCachedData(queryClient);
  await Promise.all([kept, releasePushLocally().catch(() => undefined)]);
  if (!previous) return;
  const count = await countStoredQueue(previous);
  if (count === 1) notify(t('auth.signedOutUnsentOne'));
  else if (count > 1) notify(t('auth.signedOutUnsent', { count }));
}
