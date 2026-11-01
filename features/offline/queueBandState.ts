// Pure: no react-native import, so Vitest can check it.

/** Failed tries, with a connection, after which a change counts as stuck (a few seconds back online). */
export const STUCK_FAILURES = 4;

export type QueueBandState = 'none' | 'sending' | 'stuck';

/**
 * What the band under the door says about the queue while there is a connection (bloque 13,
 * P3-1): nothing while every change goes at its first try (no band flashing on every tap),
 * «Enviando…» once one had to try again, and «No se pudo enviar.» with «Reintentar» once one keeps
 * failing. Offline the offline band speaks instead.
 */
export function queueBand(
  online: boolean,
  changes: readonly { failureCount: number }[],
): QueueBandState {
  if (!online) return 'none';
  const most = changes.reduce((n, change) => Math.max(n, change.failureCount), 0);
  if (most >= STUCK_FAILURES) return 'stuck';
  return most >= 1 ? 'sending' : 'none';
}
