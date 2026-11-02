import {
  dehydrate,
  focusManager,
  hydrate,
  MutationObserver,
  onlineManager,
  QueryClient,
  type MutationOptions,
} from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QUEUED_RETRY_DELAY, queuedFn, retryOnNetwork } from '@/data/query/retry';
import { AppError } from '@/data/supabase/errors';
import { createQueueMonitor } from './queueMonitor';

/**
 * Bloque 14.1 (P1-2 del 1 de noviembre): a change made offline stayed unsent with the connection
 * back, for minutes, until the app was restarted. This drives the real TanStack client with the
 * phone's events (connection, internet reachable or not, focus) on fake clocks, in many orders,
 * and checks that once the phone is online, reachable and in the foreground for two minutes,
 * nothing is left in the queue.
 */

type Vars = { id: string; householdId: string };

/** A fake server: answers after `latency` ms, or fails as NETWORK while the internet is down. */
function fakeServer() {
  const state = { reachable: true, latency: 300, hang: false, sent: [] as string[] };
  const fn = async ({ id }: Vars) => {
    const reachableAtStart = state.reachable;
    // A request with no answer fails as NETWORK after 15 s (`fetchWithTimeout`).
    await new Promise((resolve) => setTimeout(resolve, state.hang ? 15_000 : state.latency));
    if (state.hang) throw new AppError('NETWORK');
    if (!reachableAtStart || !state.reachable) throw new AppError('NETWORK');
    state.sent.push(id);
  };
  return { state, fn };
}

function setup(onMutateMs: () => number) {
  const server = fakeServer();
  const options: MutationOptions<void, AppError, Vars> = {
    mutationKey: ['tasks', 'create'],
    networkMode: 'online',
    retry: retryOnNetwork,
    retryDelay: QUEUED_RETRY_DELAY,
    mutationFn: queuedFn(server.fn),
    // `cancelQueries` and the optimistic note: the create awaits before its request starts.
    onMutate: async () => {
      await new Promise((resolve) => setTimeout(resolve, onMutateMs()));
    },
  };
  // The app's queue monitor runs on every client, as the root layout keeps it (bloque 14.1).
  let stopMonitor = () => undefined as void;
  const client = () => {
    const queryClient = new QueryClient();
    queryClient.setMutationDefaults(['tasks', 'create'], options);
    queryClient.mount();
    stopMonitor = createQueueMonitor(queryClient, (key) => key?.[0] === 'tasks').start();
    return queryClient;
  };
  let queryClient = client();
  let n = 0;
  /** A tap on the quick add: one observer per mutation, as `useMutation` and `runToggle` do. */
  const create = () => {
    const id = `t${++n}`;
    void new MutationObserver(queryClient, { ...options, scope: { id: 'tasks:h' } })
      .mutate({ id, householdId: 'h' })
      .catch(() => undefined);
    return id;
  };
  /** The app is killed and opened again: the queue comes back from the device and goes on. */
  const restart = () => {
    const saved = dehydrate(queryClient, {
      shouldDehydrateQuery: () => false,
      shouldDehydrateMutation: (m) => m.state.status === 'pending',
    });
    stopMonitor();
    queryClient.unmount();
    queryClient = client();
    hydrate(queryClient, {
      queries: [],
      mutations: saved.mutations.map((m) => ({ ...m, scope: { id: 'tasks:h' } })),
    });
    for (const m of queryClient.getMutationCache().findAll({ status: 'pending' })) {
      void m.continue().catch(() => undefined);
    }
  };
  const pending = () => queryClient.getMutationCache().findAll({ status: 'pending' });
  const created = () => Array.from({ length: n }, (_, i) => `t${i + 1}`);
  return { server, create, restart, pending, created, stop: () => stopMonitor() };
}

/** A tiny seeded random, so a failing sequence can be replayed. */
function random(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    return s / 2 ** 31;
  };
}

type Step =
  | { kind: 'offline' }
  | { kind: 'online'; reachableAfter: number }
  | { kind: 'flap' }
  | { kind: 'background' }
  | { kind: 'foreground' }
  | { kind: 'create' }
  | { kind: 'restart' }
  | { kind: 'hang' }
  | { kind: 'wait'; ms: number };

function sequence(seed: number): Step[] {
  const next = random(seed);
  const steps: Step[] = [];
  const count = 6 + Math.floor(next() * 14);
  for (let i = 0; i < count; i++) {
    const r = next();
    if (r < 0.18) steps.push({ kind: 'offline' });
    else if (r < 0.36) steps.push({ kind: 'online', reachableAfter: Math.floor(next() * 4000) });
    else if (r < 0.44) steps.push({ kind: 'flap' });
    else if (r < 0.52) steps.push({ kind: 'background' });
    else if (r < 0.6) steps.push({ kind: 'foreground' });
    else if (r < 0.78) steps.push({ kind: 'create' });
    else if (r < 0.82) steps.push({ kind: 'restart' });
    else if (r < 0.86) steps.push({ kind: 'hang' });
    else steps.push({ kind: 'wait', ms: Math.floor(next() * 20_000) });
  }
  return steps;
}

describe('the queue goes once the phone is online', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    onlineManager.setOnline(true);
    focusManager.setFocused(true);
  });
  afterEach(() => {
    vi.useRealTimers();
    onlineManager.setOnline(true);
    focusManager.setFocused(undefined);
  });

  it.each(Array.from({ length: 1000 }, (_, i) => i + 1))('sequence %i', async (seed) => {
    const jitter = random(seed * 7919);
    const { server, create, restart, pending, created, stop } = setup(() =>
      Math.floor(jitter() * 40),
    );
    const steps = sequence(seed);
    for (const step of steps) {
      switch (step.kind) {
        case 'offline':
          server.state.reachable = false;
          onlineManager.setOnline(false);
          break;
        case 'online':
          // «Online» comes before the internet does (isInternetReachable still unknown).
          onlineManager.setOnline(true);
          await vi.advanceTimersByTimeAsync(step.reachableAfter);
          server.state.reachable = true;
          break;
        case 'flap':
          // NetInfo says unreachable for a moment and then reachable again.
          onlineManager.setOnline(false);
          await vi.advanceTimersByTimeAsync(200);
          onlineManager.setOnline(true);
          break;
        case 'background':
          focusManager.setFocused(false);
          break;
        case 'foreground':
          focusManager.setFocused(true);
          break;
        case 'create':
          server.state.latency = 100 + Math.floor(jitter() * 3000);
          create();
          break;
        case 'restart':
          restart();
          break;
        case 'hang':
          // A weak signal: requests go out and nothing comes back until the timeout.
          server.state.hang = !server.state.hang;
          break;
        case 'wait':
          await vi.advanceTimersByTimeAsync(step.ms);
          break;
      }
      await vi.advanceTimersByTimeAsync(50);
    }
    // Back for good: online, reachable, in the foreground.
    server.state.reachable = true;
    server.state.hang = false;
    onlineManager.setOnline(true);
    focusManager.setFocused(true);
    await vi.advanceTimersByTimeAsync(120_000);
    const left = pending().map((m) => ({
      id: (m.state.variables as Vars).id,
      paused: m.state.isPaused,
      failures: m.state.failureCount,
    }));
    // Everything reached the server, each change in the order it was made. A change in flight
    // when the app was killed is sent again (the server takes it once, by its id): only the first
    // arrival of each counts for the order.
    const { sent } = server.state;
    const firstArrivals = sent.filter((id, i) => sent.indexOf(id) === i);
    stop();
    expect({ left, firstArrivals, steps }).toEqual({ left: [], firstArrivals: created(), steps });
  });
});
