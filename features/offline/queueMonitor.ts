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

const scopeOf = (m: AnyMutation) => m.options.scope?.id ?? `#${m.mutationId}`;
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
 *   and the focus coming back wake every change, not only the paused ones. If the app is in front
 *   (`isActive`) but TanStack still believes it is not, after `QUEUE_WATCH_MS` it is told.
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
  /** When each queue last moved (any change of one of its mutations). */
  const moved = new Map<string, number>();
  /** Since when, with a connection, something waits and nothing went out. */
  let since: number | null = null;
  /** Since when the app is in front while TanStack believes it is not. */
  let unfocusedSince: number | null = null;
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
    if (online && waiting.size > 0) {
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

  /** The first change of each queue that has not moved for a while is woken up. */
  const watch = () => {
    const t = now();
    // TanStack resumes nothing without the focus, and learns it from AppState's events: if the
    // app is in front and that event never came, the focus is put right, which resumes the queue.
    if (isActive() && !focusManager.isFocused() && queued().length > 0) {
      unfocusedSince ??= t;
      if (t - unfocusedSince >= QUEUE_WATCH_MS) {
        unfocusedSince = null;
        focusManager.setFocused(true);
      }
    } else {
      unfocusedSince = null;
    }
    if (!onlineManager.isOnline() || !focusManager.isFocused()) return;
    const heads = new Map<string, AnyMutation>();
    for (const m of cache
      .findAll({ status: 'pending' })
      .sort((a, b) => a.mutationId - b.mutationId)) {
      if (!heads.has(scopeOf(m))) heads.set(scopeOf(m), m);
    }
    for (const [scope, head] of heads) {
      if (!isQueued(head.options.mutationKey) && !queued().some((m) => scopeOf(m) === scope)) {
        continue;
      }
      const last = moved.get(scope) ?? t;
      if (!moved.has(scope)) moved.set(scope, t);
      if (t - last >= QUEUE_WATCH_MS) {
        moved.set(scope, t);
        void head.continue().catch(() => undefined);
      }
    }
  };

  const tick = () => {
    compute();
    watch();
    if (queued().length === 0 && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
      moved.clear();
    }
  };

  const ensureTicking = () => {
    if (timer === undefined && queued().length > 0) timer = setInterval(tick, TICK_MS);
  };

  return {
    start() {
      const offCache = cache.subscribe((event) => {
        if (event.type === 'updated' || event.type === 'added') {
          moved.set(scopeOf(event.mutation as AnyMutation), now());
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
        if (online) wakeAll();
        compute();
      });
      const offFocus = focusManager.subscribe((focused) => {
        if (focused && onlineManager.isOnline()) wakeAll();
      });
      compute();
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
