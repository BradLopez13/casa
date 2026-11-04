import {
  focusManager,
  MutationObserver,
  onlineManager,
  QueryClient,
  type MutationOptions,
} from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QUEUED_RETRY, queuedFn } from '@/data/query/retry';
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
  type Server = { reachable: boolean; latency: number; hang: boolean; sent: string[] };
  // One fake server per test, captured by that test's mutations: a change of an earlier test
  // still waiting between tries (`retryQueuedNow` wakes every waiter, whatever client it came
  // from) lands in its own list, never in this test's.
  let server: Server = { reachable: true, latency: 300, hang: false, sent: [] };
  let options: MutationOptions<void, AppError, Vars>;
  const optionsFor = (own: Server): MutationOptions<void, AppError, Vars> => ({
    mutationKey: ['tasks', 'create'],
    networkMode: 'online',
    retry: QUEUED_RETRY,
    mutationFn: queuedFn(async ({ id }: Vars) => {
      if (own.hang) await new Promise(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, own.latency));
      if (!own.reachable) throw new AppError('NETWORK');
      own.sent.push(id);
    }),
  });

  const create = (id: string, household = 'h') =>
    void new MutationObserver(queryClient, { ...options, scope: { id: `tasks:${household}` } })
      .mutate({ id, householdId: household })
      .catch(() => undefined);

  const waiting = () => [...monitor.getSnapshot().waiting].sort();

  beforeEach(() => {
    vi.useFakeTimers();
    onlineManager.setOnline(true);
    focusManager.setFocused(true);
    server = { reachable: true, latency: 300, hang: false, sent: [] };
    options = optionsFor(server);
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
    // At once (bloque 15.1): with a queue and a connection the focus is held, in front or not.
    await vi.advanceTimersByTimeAsync(2000);
    expect(server.sent).toEqual(['a']);
    expect(focusManager.isFocused()).toBe(true);
    active = false;
  });

  // Revisión de 14.1: the watch itself, without the connection event to lean on (NetInfo said
  // «online» without TanStack hearing it).
  it('wakes the first change of a queue that has not moved in 10 s, and only then', async () => {
    onlineManager.setOnline(false);
    server.reachable = false;
    create('a');
    create('b');
    await vi.advanceTimersByTimeAsync(50);
    server.reachable = true;
    // Online as far as anyone asks, but no event: neither TanStack nor the monitor hear it.
    const online = vi.spyOn(onlineManager, 'isOnline').mockReturnValue(true);
    await vi.advanceTimersByTimeAsync(QUEUE_WATCH_MS - 2000);
    expect(server.sent).toEqual([]);
    await vi.advanceTimersByTimeAsync(4000);
    expect(server.sent).toEqual(['a', 'b']);
    online.mockRestore();
  });

  it('is not fooled by changes added behind a stuck first one', async () => {
    onlineManager.setOnline(false);
    server.reachable = false;
    create('a');
    await vi.advanceTimersByTimeAsync(50);
    server.reachable = true;
    const online = vi.spyOn(onlineManager, 'isOnline').mockReturnValue(true);
    // A new change every 4 s used to restart the 10 s for the whole queue.
    for (const id of ['b', 'c', 'd', 'e']) {
      create(id);
      await vi.advanceTimersByTimeAsync(4000);
    }
    expect(server.sent).toEqual(['a', 'b', 'c', 'd', 'e']);
    online.mockRestore();
  });

  // Revisión de 14.1: the 30 s ran while the app was behind, where nothing is tried.
  it('does not say «No se pudo enviar» on coming back after a while behind', async () => {
    server.reachable = false;
    stop();
    let active = true;
    monitor = createQueueMonitor(
      queryClient,
      (key) => key?.[0] === 'tasks',
      Date.now,
      () => active,
    );
    stop = monitor.start();
    create('a');
    await vi.advanceTimersByTimeAsync(3000);
    active = false;
    focusManager.setFocused(false);
    await vi.advanceTimersByTimeAsync(QUEUE_STUCK_MS + 30_000);
    active = true;
    focusManager.setFocused(true);
    await vi.advanceTimersByTimeAsync(100);
    expect(monitor.getSnapshot().band).toBe('sending');
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

  // Bloque 15.1 (P2-1, decisión 1 A): with the connection back and the app in the background,
  // nothing went out until the app was opened (5 of 5 times, 20 to 150 s): TanStack resumes a
  // change only with the focus, and the app drops the focus as soon as it is not `active`.
  describe('the queue with the app behind (bloque 15.1)', () => {
    let active = true;
    const behind = () => {
      stop();
      monitor = createQueueMonitor(
        queryClient,
        (key) => key?.[0] === 'tasks',
        Date.now,
        () => active,
      );
      stop = monitor.start();
    };

    it('sends a change made offline once the connection is back, without coming to the front', async () => {
      behind();
      onlineManager.setOnline(false);
      server.reachable = false;
      create('a');
      await vi.advanceTimersByTimeAsync(50);
      // Home button: the app is behind, and TanStack is told so.
      active = false;
      focusManager.setFocused(false);
      await vi.advanceTimersByTimeAsync(5000);
      server.reachable = true;
      onlineManager.setOnline(true);
      await vi.advanceTimersByTimeAsync(3000);
      expect(server.sent).toEqual(['a']);
    });

    it('gives the focus back once the queue is empty behind, so coming to the front is still an event', async () => {
      behind();
      onlineManager.setOnline(false);
      create('a');
      await vi.advanceTimersByTimeAsync(50);
      active = false;
      focusManager.setFocused(false);
      onlineManager.setOnline(true);
      await vi.advanceTimersByTimeAsync(3000);
      expect(server.sent).toEqual(['a']);
      await vi.advanceTimersByTimeAsync(2000);
      expect(focusManager.isFocused()).toBe(false);
    });

    it('keeps the 30 s of «No se pudo enviar» off while behind, even with the focus held', async () => {
      behind();
      onlineManager.setOnline(false);
      create('a');
      await vi.advanceTimersByTimeAsync(50);
      active = false;
      focusManager.setFocused(false);
      server.reachable = false;
      onlineManager.setOnline(true);
      await vi.advanceTimersByTimeAsync(QUEUE_STUCK_MS + 5000);
      expect(monitor.getSnapshot().band).toBe('sending');
      expect(waiting()).toEqual(['a']);
    });

    // The 4–9 s on opening the app: the reconnect window had closed behind, so a first try that
    // failed (the token refresh) waited 1, 2 and 4 s. Coming to the front reopens the window.
    it('back in front after 90 s of connection, a failed first try is followed within a second', async () => {
      behind();
      onlineManager.setOnline(false);
      create('a');
      await vi.advanceTimersByTimeAsync(50);
      active = false;
      focusManager.setFocused(false);
      // Behind, the connection comes back but the server does not answer: the tries back off.
      server.reachable = false;
      onlineManager.setOnline(true);
      await vi.advanceTimersByTimeAsync(92_000);
      expect(server.sent).toEqual([]);
      // Opened: the first try still fails, the server answers right after.
      active = true;
      focusManager.setFocused(true);
      await vi.advanceTimersByTimeAsync(server.latency + 50);
      server.reachable = true;
      await vi.advanceTimersByTimeAsync(1500);
      expect(server.sent).toEqual(['a']);
    });

    afterEach(() => {
      active = true;
    });
  });
});
