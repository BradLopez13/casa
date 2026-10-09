import type { InvalidationBatcher } from './invalidations';

/** The slice of the realtime client the channel lifecycle needs; the hook adapts supabase. */
export type ChannelClient<C> = {
  /** Puts the current user's JWT on the socket so the private channel can join. */
  setAuth(): Promise<void>;
  /** Creates the channel, listens to `changed` broadcasts and subscribes. */
  open(topic: string, onChange: (payload: unknown) => void, onStatus: (status: string) => void): C;
  /** Leaves the channel; resolves with 'ok' when the leave went through. */
  remove(channel: C): Promise<string>;
  teardown(channel: C): void;
  /** Whether the client still keeps a channel for `topic`. */
  isListed(topic: string): boolean;
  /** Drops the channel from the client's list so the next open starts fresh. */
  forget(channel: C): void;
};

export type HouseholdChannelOptions<C> = {
  householdId: string;
  client: ChannelClient<C>;
  batcher: Pick<InvalidationBatcher, 'push' | 'flushAll'>;
  /** Resolves once the previous channel for this hook is gone. */
  after: Promise<unknown>;
  setTimer: typeof setTimeout;
  clearTimer: typeof clearTimeout;
  /** Waits between re-opens after the server closes the channel; the last one repeats. */
  retryDelaysMs?: readonly number[];
};

export type HouseholdChannel = {
  /** Closes the channel for good; resolves (never rejects) once it has been removed. */
  stop(): Promise<void>;
};

const DEFAULT_RETRY_DELAYS_MS = [1000, 2000, 5000, 10000] as const;

const noop = () => undefined;

/**
 * Keeps one private `household:{id}` channel alive: errors and timeouts are rejoined by
 * the client itself, a server close is re-opened here with a bounded backoff, and every
 * return to SUBSCRIBED after a loss refetches everything once.
 */
export function openHouseholdChannel<C>(opts: HouseholdChannelOptions<C>): HouseholdChannel {
  const { client, batcher } = opts;
  const topic = `household:${opts.householdId}`;
  const delays = opts.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;

  let stopped = false;
  let channel: C | undefined;
  // Bumped whenever a channel is dropped, so late callbacks from it are ignored.
  let generation = 0;
  let lostConnection = false;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  // Opens and removals run one after another and the queue never rejects.
  let queue: Promise<void> = opts.after.then(noop, noop);
  function enqueue(step: () => Promise<void> | void): Promise<void> {
    queue = queue.then(step).then(noop, noop);
    return queue;
  }

  async function release(dead: C): Promise<void> {
    let status: string;
    try {
      status = await client.remove(dead);
    } catch {
      status = 'error';
    }
    // A failed leave leaves the channel listed as 'leaving', and opening the same topic
    // would hand it back already dead.
    if (status !== 'ok') client.teardown(dead);
    if (client.isListed(topic)) client.forget(dead);
  }

  async function connect(): Promise<void> {
    await client.setAuth().catch(noop);
    if (stopped) return;
    const mine = ++generation;
    try {
      channel = client.open(
        topic,
        (payload) => {
          const table = (payload as { table?: unknown } | null | undefined)?.table;
          if (typeof table === 'string') batcher.push(table);
        },
        (status) => {
          if (mine === generation && !stopped) onStatus(status);
        },
      );
    } catch {
      channel = undefined;
      scheduleRetry();
    }
  }

  function onStatus(status: string) {
    if (status === 'SUBSCRIBED') {
      attempt = 0;
      // Broadcasts sent while we were away are lost: refetch everything once.
      if (lostConnection) batcher.flushAll();
      lostConnection = false;
      return;
    }
    lostConnection = true;
    // The client rejoins after CHANNEL_ERROR and TIMED_OUT, but not after the server
    // closes the channel: drop it and open a new one.
    if (status === 'CLOSED') {
      generation++;
      const dead = channel;
      channel = undefined;
      if (dead !== undefined) void enqueue(() => release(dead));
      scheduleRetry();
    }
  }

  function scheduleRetry() {
    if (stopped || retryTimer !== undefined) return;
    const delay = delays[Math.min(attempt, delays.length - 1)] ?? 0;
    attempt++;
    retryTimer = opts.setTimer(() => {
      retryTimer = undefined;
      void enqueue(connect);
    }, delay);
  }

  void enqueue(connect);

  return {
    stop() {
      stopped = true;
      generation++;
      if (retryTimer !== undefined) {
        opts.clearTimer(retryTimer);
        retryTimer = undefined;
      }
      return enqueue(async () => {
        const dead = channel;
        channel = undefined;
        if (dead !== undefined) await release(dead);
      });
    },
  };
}
