// Pure: no react-native import, so Vitest can check it.
import type { MutationKey, QueryClient } from '@tanstack/react-query';

/** How the phone gives the queue its network back while it is behind (`modules/queue-background`). */
export type NetworkPass = { hold: () => void; release: () => void };

/**
 * Asks the phone for the network while the app is behind with changes waiting, and lets it go as
 * soon as the queue is empty or the app is in front (bloque 15.1, prueba en el .51 del 4 de
 * noviembre). Some 5 s after the app goes behind, Android takes its network away
 * (`blocked=APP_BACKGROUND`, the background firewall chain of Android 15): the queue's tries kept
 * going (on a native wait) but every one failed until the app was opened. A job that needs the
 * network gives it back while it runs; in front the app has it anyway, so the job is only asked for
 * behind. Driven by events only (the queue's, AppState's): behind, no JS timer fires.
 */
export function watchNetworkPass(
  queryClient: QueryClient,
  isQueued: (key: MutationKey | undefined) => boolean,
  pass: NetworkPass,
  isActive: () => boolean,
  onActiveChange: (listener: (active: boolean) => void) => () => void,
): () => void {
  const cache = queryClient.getMutationCache();
  let holding = false;

  const waiting = () =>
    cache.findAll({ status: 'pending' }).some((m) => isQueued(m.options.mutationKey));

  const update = () => {
    const want = !isActive() && waiting();
    if (want === holding) return;
    holding = want;
    if (want) pass.hold();
    else pass.release();
  };

  const offCache = cache.subscribe(update);
  const offActive = onActiveChange(update);
  update();
  return () => {
    offCache();
    offActive();
    if (holding) {
      holding = false;
      pass.release();
    }
  };
}
