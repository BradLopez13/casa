import type { QueryKey } from '@tanstack/react-query';
// From keys, which features/households/queries re-exports: the batcher needs no React.
import { householdsKey, membershipKey } from '@/features/households/keys';

/**
 * Query keys to refresh when the server broadcasts a change to `table` on `householdId`'s
 * channel: that household's lists only (every household's stays loaded, `useWarmHouseholds`, and
 * refreshing them all cost about nine requests per event with three; bloque 13, Aud P3-2). The
 * membership and the household list are the person's, across households.
 */
export function invalidationsFor(table: string, householdId: string): QueryKey[] {
  switch (table) {
    case 'shopping_items':
      return [
        ['shopping', householdId],
        ['shopping-history', householdId],
      ];
    // The household itself: its name and owner live in the membership and the household list.
    case 'households':
      return [membershipKey, householdsKey];
    // Who is in, who left, who owns it: the member list, the role and the household's size.
    case 'household_members':
      return [['members', householdId], membershipKey, householdsKey];
    // Its licence (bloque 12): the band and the licence screen.
    case 'household_licenses':
      return [['license', householdId], membershipKey, householdsKey];
    case 'task_series':
    case 'task_occurrences':
      return [['tasks', householdId]];
    default:
      return [];
  }
}

export type InvalidationBatcherOptions = {
  /** The household whose channel this is: its keys are the ones refreshed. */
  householdId: string;
  delayMs: number;
  /** A key with a mutation in flight is skipped: the mutation refreshes it when it settles. */
  isBusy: (key: QueryKey) => boolean;
  invalidate: (key: QueryKey) => void;
  setTimer: typeof setTimeout;
  clearTimer: typeof clearTimeout;
};

export type InvalidationBatcher = {
  /** Queues the keys for `table`; the first push opens a window of `delayMs`. */
  push(table: string): void;
  /** Refreshes every realtime-backed key now (used after a reconnection). */
  flushAll(): void;
  /** Cancels the pending window; later pushes are ignored. */
  dispose(): void;
};

export function createInvalidationBatcher(opts: InvalidationBatcherOptions): InvalidationBatcher {
  // Keyed by the serialized query key so a burst refreshes each key once.
  const pending = new Map<string, QueryKey>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  function cancelTimer() {
    if (timer !== undefined) {
      opts.clearTimer(timer);
      timer = undefined;
    }
  }

  function invalidateAll(keys: Iterable<QueryKey>) {
    for (const key of keys) {
      if (!opts.isBusy(key)) opts.invalidate(key);
    }
  }

  function flush() {
    timer = undefined;
    const keys = [...pending.values()];
    pending.clear();
    invalidateAll(keys);
  }

  return {
    push(table) {
      if (disposed) return;
      const keys = invalidationsFor(table, opts.householdId);
      if (keys.length === 0) return;
      for (const key of keys) pending.set(JSON.stringify(key), key);
      if (timer === undefined) timer = opts.setTimer(flush, opts.delayMs);
    },
    flushAll() {
      if (disposed) return;
      cancelTimer();
      pending.clear();
      const h = opts.householdId;
      invalidateAll([
        ['tasks', h],
        ['shopping', h],
        ['shopping-history', h],
        ['members', h],
        ['license', h],
        membershipKey,
        householdsKey,
      ]);
    },
    dispose() {
      disposed = true;
      cancelTimer();
      pending.clear();
    },
  };
}
