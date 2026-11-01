import {
  focusManager,
  MutationObserver,
  onlineManager,
  QueryClient,
  type MutationOptions,
} from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QUEUED_RETRY_DELAY, queuedFn, retryOnNetwork } from '@/data/query/retry';
import { AppError } from '@/data/supabase/errors';
import {
  createQueueMonitor,
  QUEUE_GRACE_MS,
  QUEUE_STUCK_MS,
  QUEUE_WATCH_MS,
  type QueueMonitor,
} from './queueMonitor';

type Vars = { id: string; householdId: string };

/**
 * Bloque 14.1 (P1-2 y T15 del 1 de noviembre): with the connection back, a change still in the
 * queue said nothing (no «Sin enviar», no band), and its mark only changed when something else
 * touched the queue, minutes later. The monitor says what waits, reacts to the connection, and
 * wakes the queue when it does not move.
 */
describe('queue monitor', () => {
  let queryClient: QueryClient;
  let monitor: QueueMonitor;
  let stop: () => void;
  const server = { reachable: true, latency: 300, hang: false, sent: [] as string[] };

  const options: MutationOptions<void, AppError, Vars> = {
    mutationKey: ['tasks', 'create'],
    networkMode: 'online',
    retry: retryOnNetwork,
    retryDelay: QUEUED_RETRY_DELAY,
    mutationFn: queuedFn(async ({ id }: Vars) => {
      if (server.hang) await new Promise(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, server.latency));
      if (!server.reachable) throw new AppError('NETWORK');
      server.sent.push(id);
    }),
  };

  const create = (id: string, household = 'h') =>
    void new MutationObserver(queryClient, { ...options, scope: { id: `tasks:${household}` } })
      .mutate({ id, householdId: household })
      .catch(() => undefined);

  const waiting = () => [...monitor.getSnapshot().waiting].sort();

  beforeEach(() => {
    vi.useFakeTimers();
    onlineManager.setOnline(true);
    focusManager.setFocused(true);
    Object.assign(server, { reachable: true, latency: 300, hang: false, sent: [] });
    queryClient = new QueryClient();
    queryClient.mount();
    monitor = createQueueMonitor(
      queryClient,
      (key: readonly unknown[] | undefined) => key?.[0] === 'tasks',
    );
    stop = monitor.start();
  });
  afterEach(() => {
    stop();
    queryClient.unmount();
    vi.useRealTimers();
    onlineManager.setOnline(true);
    focusManager.setFocused(undefined);
  });

  it('marks nothing while a change goes at its first try', async () => {
    create('a');
    await vi.advanceTimersByTimeAsync(100);
    expect(waiting()).toEqual([]);
    expect(monitor.getSnapshot().band).toBe('none');
    await vi.advanceTimersByTimeAsync(400);
    expect(server.sent).toEqual(['a']);
    expect(waiting()).toEqual([]);
  });

  it('marks a change made offline at once, and the band stays quiet offline', async () => {
    onlineManager.setOnline(false);
    server.reachable = false;
    create('a');
    await vi.advanceTimersByTimeAsync(50);
    expect(waiting()).toEqual(['a']);
    expect(monitor.getSnapshot().band).toBe('none');
  });

  // The mark of «Prueba cola tres» went with the change still in the queue.
  it('keeps the mark with the connection back until the change reaches the server', async () => {
    onlineManager.setOnline(false);
    server.reachable = false;
    create('a');
    await vi.advanceTimersByTimeAsync(50);
    // «Online» comes before the internet does: the first tries fail.
    onlineManager.setOnline(true);
    await vi.advanceTimersByTimeAsync(100);
    expect(waiting()).toEqual(['a']);
    expect(monitor.getSnapshot().band).toBe('sending');
    server.reachable = true;
    await vi.advanceTimersByTimeAsync(3000);
    expect(server.sent).toEqual(['a']);
    expect(waiting()).toEqual([]);
    expect(monitor.getSnapshot().band).toBe('none');
  });

  // T15: the predicate read `isOnline()` without listening to it.
  it('reacts to the connection itself, not only to the queue changing', async () => {
    server.hang = true;
    create('a');
    create('b');
    await vi.advanceTimersByTimeAsync(50);
    // «b» waits its turn behind «a», with a connection: not marked yet (no flash on a quick undo).
    expect(waiting()).toEqual([]);
    const seen: string[][] = [];
    const off = monitor.subscribe(() => seen.push(waiting()));
    onlineManager.setOnline(false);
    expect(seen.at(-1)).toEqual(['b']);
    off();
  });

  it('marks a change still not sent after a short grace, and says «Enviando…»', async () => {
    server.hang = true;
    create('a');
    await vi.advanceTimersByTimeAsync(QUEUE_GRACE_MS + 1000);
    expect(waiting()).toEqual(['a']);
    expect(monitor.getSnapshot().band).toBe('sending');
  });

  it('says «No se pudo enviar» when nothing went out in 30 s with a connection', async () => {
    server.reachable = false;
    create('a');
    await vi.advanceTimersByTimeAsync(QUEUE_STUCK_MS - 2000);
    expect(monitor.getSnapshot().band).toBe('sending');
    await vi.advanceTimersByTimeAsync(3000);
    expect(monitor.getSnapshot().band).toBe('stuck');
    // «Reintentar»: «Enviando…» at once, and the change goes as soon as the server answers.
    server.reachable = true;
    monitor.retryNow();
    expect(monitor.getSnapshot().band).toBe('sending');
    await vi.advanceTimersByTimeAsync(1500);
    expect(server.sent).toEqual(['a']);
    expect(monitor.getSnapshot().band).toBe('none');
  });

  // T5: «Reintentar» used to wait for the timer already set, up to 15 s.
  it('tries again at once when «Reintentar» is tapped', async () => {
    server.reachable = false;
    create('a');
    await vi.advanceTimersByTimeAsync(QUEUE_STUCK_MS + 5000);
    server.reachable = true;
    server.latency = 10;
    monitor.retryNow();
    await vi.advanceTimersByTimeAsync(100);
    expect(server.sent).toEqual(['a']);
  });

  it('wakes a queue left paused with the connection back', async () => {
    onlineManager.setOnline(false);
    server.reachable = false;
    create('a');
    create('b');
    await vi.advanceTimersByTimeAsync(50);
    // The connection comes back without TanStack hearing it (the case on the .51): nobody calls
    // `resumePausedMutations`.
    server.reachable = true;
    vi.spyOn(queryClient, 'resumePausedMutations').mockResolvedValue(undefined);
    onlineManager.setOnline(true);
    await vi.advanceTimersByTimeAsync(QUEUE_WATCH_MS + 2000);
    expect(server.sent).toEqual(['a', 'b']);
    expect(waiting()).toEqual([]);
  });

  // Candidate (c) of the hoja: TanStack only resumes with the focus, and it learns the focus from
  // AppState's events. If the app is in front but that event never came, nothing resumes.
  it('wakes the queue when the app is in front but the focus was never told', async () => {
    stop();
    let active = true;
    monitor = createQueueMonitor(
      queryClient,
      (key) => key?.[0] === 'tasks',
      Date.now,
      () => active,
    );
    stop = monitor.start();
    onlineManager.setOnline(false);
    server.reachable = false;
    create('a');
    await vi.advanceTimersByTimeAsync(50);
    focusManager.setFocused(false);
    server.reachable = true;
    onlineManager.setOnline(true);
    // Not at once: an AppState event on its way gets its moment.
    await vi.advanceTimersByTimeAsync(QUEUE_WATCH_MS - 2000);
    expect(server.sent).toEqual([]);
    await vi.advanceTimersByTimeAsync(4000);
    expect(server.sent).toEqual(['a']);
    expect(focusManager.isFocused()).toBe(true);
    active = false;
  });

  it('keeps each household to its own queue', async () => {
    server.hang = true;
    create('a', 'h1');
    await vi.advanceTimersByTimeAsync(10);
    server.hang = false;
    create('b', 'h2');
    await vi.advanceTimersByTimeAsync(500);
    expect(server.sent).toEqual(['b']);
  });
});
