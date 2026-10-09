import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openHouseholdChannel, type ChannelClient } from './householdChannel';

type FakeChannel = {
  topic: string;
  onChange: (payload: unknown) => void;
  onStatus: (status: string) => void;
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function setup(opts: { setAuth?: () => Promise<void>; removeStatus?: string } = {}) {
  const opened: FakeChannel[] = [];
  const listed = new Set<string>();
  const client = {
    setAuth: vi.fn(opts.setAuth ?? (() => Promise.resolve())),
    open: vi.fn<ChannelClient<FakeChannel>['open']>((topic, onChange, onStatus) => {
      const channel = { topic, onChange, onStatus };
      opened.push(channel);
      listed.add(topic);
      return channel;
    }),
    remove: vi.fn((channel: FakeChannel) => {
      const status = opts.removeStatus ?? 'ok';
      if (status === 'ok') listed.delete(channel.topic);
      return Promise.resolve(status);
    }),
    teardown: vi.fn<(channel: FakeChannel) => void>(),
    isListed: vi.fn((topic: string) => listed.has(topic)),
    forget: vi.fn((channel: FakeChannel) => {
      listed.delete(channel.topic);
    }),
  } satisfies ChannelClient<FakeChannel>;
  const batcher = { push: vi.fn<(table: string) => void>(), flushAll: vi.fn<() => void>() };
  const channel = openHouseholdChannel({
    householdId: 'h',
    client,
    batcher,
    after: Promise.resolve(),
    setTimer: setTimeout,
    clearTimer: clearTimeout,
  });
  return { channel, client, batcher, opened, listed };
}

describe('openHouseholdChannel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('authenticates, then opens the household topic and forwards the changed table', async () => {
    const { client, batcher, opened } = setup();
    await vi.advanceTimersByTimeAsync(0);
    expect(client.setAuth).toHaveBeenCalledTimes(1);
    expect(client.open).toHaveBeenCalledTimes(1);
    expect(opened[0]?.topic).toBe('household:h');

    opened[0]?.onChange({ table: 'shopping_items', id: 'x' });
    opened[0]?.onChange({ nope: 1 });
    opened[0]?.onChange(undefined);
    expect(batcher.push.mock.calls).toEqual([['shopping_items']]);
  });

  it('creates no channel when stopped before setAuth resolves', async () => {
    const auth = deferred();
    const { channel, client } = setup({ setAuth: () => auth.promise });
    await vi.advanceTimersByTimeAsync(0);
    const stopped = channel.stop();
    auth.resolve();
    await stopped;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(client.open).not.toHaveBeenCalled();
    expect(client.remove).not.toHaveBeenCalled();
  });

  it('refetches everything once when it rejoins after an error', async () => {
    const { batcher, opened } = setup();
    await vi.advanceTimersByTimeAsync(0);
    const ch = opened[0]!;
    ch.onStatus('SUBSCRIBED');
    expect(batcher.flushAll).not.toHaveBeenCalled();

    ch.onStatus('CHANNEL_ERROR');
    ch.onStatus('SUBSCRIBED');
    ch.onStatus('SUBSCRIBED');
    expect(batcher.flushAll).toHaveBeenCalledTimes(1);
  });

  it('re-opens after the server closes the channel, backing off', async () => {
    const { client, batcher, opened } = setup();
    await vi.advanceTimersByTimeAsync(0);
    opened[0]!.onStatus('SUBSCRIBED');

    opened[0]!.onStatus('CLOSED');
    await vi.advanceTimersByTimeAsync(0);
    expect(client.remove).toHaveBeenCalledWith(opened[0]);
    expect(client.open).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(client.open).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(client.open).toHaveBeenCalledTimes(2);

    // Late callbacks from the dropped channel are ignored.
    opened[0]!.onStatus('CLOSED');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(client.open).toHaveBeenCalledTimes(2);

    // Closed again before it ever joined: the next wait is longer.
    opened[1]!.onStatus('CLOSED');
    await vi.advanceTimersByTimeAsync(1999);
    expect(client.open).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(client.open).toHaveBeenCalledTimes(3);

    opened[2]!.onStatus('SUBSCRIBED');
    expect(batcher.flushAll).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending re-open when stopped', async () => {
    const { channel, client, opened } = setup();
    await vi.advanceTimersByTimeAsync(0);
    opened[0]!.onStatus('CLOSED');
    await channel.stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(client.open).toHaveBeenCalledTimes(1);
  });

  it('removes the channel on stop and ignores the CLOSED it causes', async () => {
    const { channel, client, opened, listed } = setup();
    await vi.advanceTimersByTimeAsync(0);
    await channel.stop();
    opened[0]!.onStatus('CLOSED');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(client.remove).toHaveBeenCalledTimes(1);
    expect(client.teardown).not.toHaveBeenCalled();
    expect(client.open).toHaveBeenCalledTimes(1);
    expect(listed.size).toBe(0);
  });

  it('tears down and forgets a channel whose leave failed', async () => {
    const { channel, client, opened, listed } = setup({ removeStatus: 'error' });
    await vi.advanceTimersByTimeAsync(0);
    await channel.stop();
    expect(client.teardown).toHaveBeenCalledWith(opened[0]);
    expect(client.forget).toHaveBeenCalledWith(opened[0]);
    expect(listed.has('household:h')).toBe(false);
  });

  it('retries when opening throws, and stop still resolves', async () => {
    const { channel, client } = setup();
    client.open.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(client.open).toHaveBeenCalledTimes(2);
    await expect(channel.stop()).resolves.toBeUndefined();
  });
});
