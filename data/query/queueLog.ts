// Pure: no react-native import, so Vitest can check it.
import {
  focusManager,
  onlineManager,
  type Mutation,
  type QueryClient,
} from '@tanstack/react-query';

/**
 * The queue's log, only in a build made with `EXPO_PUBLIC_QUEUE_LOG=1` (bloque 14.1: to see why a
 * change made offline stayed unsent with the connection back). Each change of a mutation (its key,
 * scope, status, `isPaused`, `failureCount`), each change of connection and focus, each request to
 * the server, and every 5 s while something is pending, the whole queue. Read with
 * `adb logcat -s ReactNativeJS`. Nothing personal: keys, scopes and states, never variables.
 */
export const queueLogOn = process.env.EXPO_PUBLIC_QUEUE_LOG === '1';

const DUMP_MS = 5000;
const started = Date.now();

const since = () => ((Date.now() - started) / 1000).toFixed(1);

export function describeMutation(m: Pick<Mutation, 'mutationId' | 'options' | 'state'>): string {
  const key = (m.options.mutationKey ?? []).join('/');
  const scope = (m.options.scope?.id ?? '-').replace(/:[0-9a-f-]{8}.*/, ':…');
  const { status, isPaused, failureCount } = m.state;
  return `#${m.mutationId} ${key} [${scope}] ${status}${isPaused ? ' paused' : ''} f=${failureCount}`;
}

export function queueLog(line: string): void {
  console.warn(`[queue ${since()}s] ${line}`);
}

/** Starts the log on this client; returns how to stop it (for the tests). */
export function startQueueLog(queryClient: QueryClient): () => void {
  const cache = queryClient.getMutationCache();
  const offCache = cache.subscribe((event) => {
    if (event.type === 'updated')
      queueLog(`${event.action.type} ${describeMutation(event.mutation)}`);
    else if (event.type === 'added' || event.type === 'removed') {
      queueLog(`${event.type} ${describeMutation(event.mutation)}`);
    }
  });
  const offOnline = onlineManager.subscribe((online) => queueLog(`online=${online}`));
  const offFocus = focusManager.subscribe((focused) => queueLog(`focused=${focused}`));
  const timer = setInterval(() => {
    const pending = cache.findAll({ status: 'pending' });
    if (pending.length === 0) return;
    queueLog(
      `dump online=${onlineManager.isOnline()} focused=${focusManager.isFocused()} ` +
        pending.map(describeMutation).join(' | '),
    );
  }, DUMP_MS);
  return () => {
    offCache();
    offOnline();
    offFocus();
    clearInterval(timer);
  };
}

/** `fetch` that logs when a request to the server starts and how it ends (its path, no query). */
export function loggedFetch(base: typeof fetch): typeof fetch {
  let next = 0;
  return async (input, init) => {
    const n = ++next;
    const url = String(input instanceof Request ? input.url : input);
    const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '');
    queueLog(`fetch ${n} start ${path}`);
    try {
      const response = await base(input, init);
      queueLog(`fetch ${n} ${response.status} ${path}`);
      return response;
    } catch (error) {
      queueLog(`fetch ${n} failed ${(error as Error)?.name ?? 'error'} ${path}`);
      throw error;
    }
  };
}
