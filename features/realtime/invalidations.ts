import type { QueryKey } from '@tanstack/react-query';
// From keys, which features/households/queries re-exports: the batcher needs no React.
import { membershipKey } from '@/features/households/keys';

const TASKS: QueryKey = ['tasks'];
const SHOPPING: QueryKey = ['shopping'];
const SHOPPING_HISTORY: QueryKey = ['shopping-history'];
// Every household's member list (membersKey is ['members', householdId]).
const MEMBERS: QueryKey = ['members'];

/**
 * Query prefixes to refresh when the server broadcasts a change to `table`. They are
 * prefixes, so they cover every household's cache.
 */
export function invalidationsFor(table: string): QueryKey[] {
  switch (table) {
    case 'shopping_items':
      return [SHOPPING, SHOPPING_HISTORY];
    // The household itself: its name and owner live in the membership.
    case 'households':
      return [membershipKey];
    // Who is in, who left, who owns it: the member lists and the role in the membership.
    case 'household_members':
      return [MEMBERS, membershipKey];
    case 'task_series':
    case 'task_occurrences':
      return [TASKS];
    default:
      return [];
  }
}

export type InvalidationBatcherOptions = {
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
      const keys = invalidationsFor(table);
      if (keys.length === 0) return;
      for (const key of keys) pending.set(JSON.stringify(key), key);
      if (timer === undefined) timer = opts.setTimer(flush, opts.delayMs);
    },
    flushAll() {
      if (disposed) return;
      cancelTimer();
      pending.clear();
      invalidateAll([TASKS, SHOPPING, SHOPPING_HISTORY, MEMBERS, membershipKey]);
    },
    dispose() {
      disposed = true;
      cancelTimer();
      pending.clear();
    },
  };
}
