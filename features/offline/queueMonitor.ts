// Pure: no react-native import, so Vitest can check it.
import {
  focusManager,
  onlineManager,
  type Mutation,
  type MutationKey,
  type QueryClient,
} from '@tanstack/react-query';
import { markOnline, retryQueuedNow } from '@/data/query/retry';

/** A change still not on the server after this long, with a connection, is marked as waiting. */
export const QUEUE_GRACE_MS = 2000;
/** With a connection and something waiting, «No se pudo enviar» once nothing went out in this long. */
export const QUEUE_STUCK_MS = 30_000;
/** A queue that has not moved in this long, with a connection, is woken up (and again after as long). */
export const QUEUE_WATCH_MS = 10_000;
/** How often the monitor looks while something is pending. */
const TICK_MS = 1000;

export type QueueBandState = 'none' | 'sending' | 'stuck';

export type QueueSnapshot = {
  /** The ids (of the task or the item) with a change waiting: their note says «Sin enviar». */
  waiting: ReadonlySet<string>;
  /** What the band under the door says, with a connection (`QueueBand`). */
  band: QueueBandState;
};

export type QueueMonitor = {
  /** Starts listening to the queue, the connection and the focus; returns how to stop. */
  start: () => () => void;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => QueueSnapshot;
  /** «Reintentar»: every queue tries again now. */
  retryNow: () => void;
};

type AnyMutation = Mutation;

const NONE: QueueSnapshot = { waiting: new Set(), band: 'none' };

const idOf = (m: AnyMutation) => (m.state.variables as { id?: unknown } | undefined)?.id;

/**
 * Watches the offline queue (bloque 14.1, P1-2 del 1 de noviembre). Three jobs:
 *
 * - **Says what waits**, reacting to the queue, the connection and the time: a queued change is
 *   waiting once it had to wait (paused offline, a failed try) or once it has been on its way for
 *   `QUEUE_GRACE_MS` (a paused change behind another, a request that does not answer), and stays
 *   waiting until it settles. A change at its first try is not marked: no flash on every tap.
 * - **Says it in the band:** with a connection and something waiting, «Enviando…», and «No se pudo
 *   enviar» with «Reintentar» once nothing went out for `QUEUE_STUCK_MS` (decisión 2 A).
 * - **Keeps the queue moving:** TanStack wakes a paused change only when the connection or the
 *   focus comes back, and when the change before it settles, and only if it can run at that very
 *   moment; a queue that missed its turn stayed paused with a connection until the app was
 *   restarted. With a connection and the app in front, a queue that has not moved for
 *   `QUEUE_WATCH_MS` has its first change woken up, again every `QUEUE_WATCH_MS`; the connection
 *   and the focus coming back wake every change, not only the paused ones.
 * - **Holds the focus while something waits** (bloque 15.1, decisión 1 A de Brad): TanStack
 *   resumes a change only with the focus, and the app drops it as soon as it is not `active`, so
 *   a change made offline waited in the background until the app was opened (crítica del 2 de
 *   noviembre, P2-1). With a connection and a queue the focus is held, in front or not; once the
 *   queue is empty behind, it is given back, so coming to the front is a focus event again. The
 *   known cost: the stale queries refetch once behind, when the focus is held, and once more on
 *   coming to the front (`queryCache.onFocus`). The 30 s of «No se pudo enviar» follow the phone
 *   (`isActive`), not the held focus: behind, they do not run.
 */
export function createQueueMonitor(
  queryClient: QueryClient,
  isQueued: (key: MutationKey | undefined) => boolean,
  now: () => number = Date.now,
  /** Whether the app is in front as the phone says (AppState), to check TanStack's own idea. */
  isActive: () => boolean = () => focusManager.isFocused(),
): QueueMonitor {
  const cache = queryClient.getMutationCache();
  const listeners = new Set<() => void>();
  /** Changes that waited once: marked until they settle. */
  const waited = new WeakSet<AnyMutation>();
  /** Each queue's first change and when it last moved: only that one holds the queue up. */
  const heads = new Map<string, { id: number; at: number }>();
  /** Since when, with a connection, something waits and nothing went out. */
  let since: number | null = null;
  /** Whether the monitor holds TanStack's focus for the queue while the app is behind. */
  let holding = false;
  let wasActive = isActive();
  let snapshot = NONE;
  let timer: ReturnType<typeof setInterval> | undefined;

  const queued = () =>
    cache
      .findAll({ status: 'pending' })
      .filter((m) => isQueued(m.options.mutationKey))
      .sort((a, b) => a.mutationId - b.mutationId);

  const compute = () => {
    const t = now();
    const online = onlineManager.isOnline();
    const waiting = new Set<string>();
    for (const m of queued()) {
      const { isPaused, failureCount, submittedAt } = m.state;
      if (
        waited.has(m) ||
        (isPaused && !online) ||
        failureCount > 0 ||
        (submittedAt > 0 && t - submittedAt >= QUEUE_GRACE_MS)
      ) {
        waited.add(m);
        const id = idOf(m);
        if (typeof id === 'string') waiting.add(id);
      }
    }
    let band: QueueBandState = 'none';
    // The 30 s only run with the app in front: behind, the queue goes (the focus is held) but a
    // weak signal is the rule there, so coming back after a while must not say at once that
    // nothing could be sent.
    if (online && waiting.size > 0 && !isActive()) {
      since = null;
      band = 'sending';
    } else if (online && waiting.size > 0) {
      since ??= t;
      band = t - since >= QUEUE_STUCK_MS ? 'stuck' : 'sending';
    } else {
      since = null;
    }
    const same =
      band === snapshot.band &&
      waiting.size === snapshot.waiting.size &&
      [...waiting].every((id) => snapshot.waiting.has(id));
    if (!same) {
      snapshot = waiting.size === 0 && band === 'none' ? NONE : { waiting, band };
      for (const listener of [...listeners]) listener();
    }
  };

  /** Every pending change of the queue goes on, in order: what can run runs, the rest pauses. */
  const wakeAll = () => {
    for (const m of queued()) void m.continue().catch(() => undefined);
  };

  /**
   * With a connection and a queue, TanStack has the focus whatever the phone says (and whether
   * AppState's event ever came): that is what resumes the queue. Once the queue is empty with the
   * app behind, the focus goes back to following the phone.
   */
  const hold = () => {
    const active = isActive();
    if (holding && active && !wasActive) {
      // Came to the front while held: the refetch a focus event would have brought.
      holding = false;
      queryClient.getQueryCache().onFocus();
    }
    wasActive = active;
    if (onlineManager.isOnline() && queued().length > 0) {
      if (!focusManager.isFocused()) {
        holding = !active;
        focusManager.setFocused(true);
      }
      return;
    }
    if (holding && queued().length === 0) {
      holding = false;
      if (!active) focusManager.setFocused(false);
    }
  };

  /** The first change of each queue that has not moved for a while is woken up. */
  const watch = () => {
    const t = now();
    if (!onlineManager.isOnline() || !focusManager.isFocused()) return;
    const firsts = new Map<string, AnyMutation>();
    for (const m of queued()) {
      const scope = m.options.scope?.id;
      if (scope !== undefined && !firsts.has(scope)) firsts.set(scope, m);
    }
    for (const scope of [...heads.keys()]) if (!firsts.has(scope)) heads.delete(scope);
    for (const [scope, first] of firsts) {
      const known = heads.get(scope);
      if (known?.id !== first.mutationId) {
        // A new first change: its 10 s start now.
        heads.set(scope, { id: first.mutationId, at: t });
      } else if (t - known.at >= QUEUE_WATCH_MS) {
        heads.set(scope, { id: first.mutationId, at: t });
        void first.continue().catch(() => undefined);
      }
    }
  };

  const tick = () => {
    compute();
    hold();
    watch();
    if (queued().length === 0 && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
      heads.clear();
    }
  };

  const ensureTicking = () => {
    if (timer === undefined && queued().length > 0) timer = setInterval(tick, TICK_MS);
  };

  return {
    start() {
      const offCache = cache.subscribe((event) => {
        if (event.type === 'updated') {
          // Only the first change of a queue moving counts as the queue moving.
          const scope = event.mutation.options.scope?.id;
          const head = scope === undefined ? undefined : heads.get(scope);
          if (head?.id === event.mutation.mutationId) head.at = now();
          if (
            event.type === 'updated' &&
            event.action.type === 'success' &&
            isQueued(event.mutation.options.mutationKey) &&
            since !== null
          ) {
            // Something went out: the 30 s start again.
            since = now();
          }
        }
        compute();
        ensureTicking();
      });
      const offOnline = onlineManager.subscribe((online) => {
        if (online) {
          hold();
          wakeAll();
        }
        compute();
      });
      const offFocus = focusManager.subscribe((focused) => {
        // Back in front: the reconnect window opens again (the tries go every second, not 1, 2
        // and 4 s: the 4–9 s on opening the app, bloque 15.1), every wait between two tries is
        // cut short and the queues go on.
        if (focused && onlineManager.isOnline()) {
          markOnline();
          retryQueuedNow();
          wakeAll();
        }
        compute();
      });
      compute();
      hold();
      ensureTicking();
      return () => {
        offCache();
        offOnline();
        offFocus();
        if (timer !== undefined) clearInterval(timer);
        timer = undefined;
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    retryNow() {
      // The next tries go every second, and every wait between two tries is cut short.
      markOnline();
      retryQueuedNow();
      wakeAll();
      if (since !== null) since = now();
      compute();
    },
  };
}
