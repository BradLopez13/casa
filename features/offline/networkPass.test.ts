import { MutationObserver, onlineManager, QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchNetworkPass, type NetworkPass } from './networkPass';

// Bloque 15.1, prueba en el .51 del 4 de noviembre: some 5 s after the app goes behind, Android
// takes its network away (`blocked=APP_BACKGROUND` in `dumpsys netpolicy`, the background
// firewall chain of Android 15 on). A change that had not gone out by then waited for the app to
// be opened. A job that needs the network gives it back while it runs: the app asks for it only
// behind with changes waiting, and lets it go as soon as the queue is empty or it is in front.

type Vars = { id: string };

function setup(active = true) {
  const queryClient = new QueryClient();
  queryClient.mount();
  const pass: NetworkPass & { calls: string[] } = {
    calls: [],
    hold() {
      this.calls.push('hold');
    },
    release() {
      this.calls.push('release');
    },
  };
  let isActive = active;
  const listeners = new Set<(active: boolean) => void>();
  const server: { answer: (() => void)[] } = { answer: [] };
  const stop = watchNetworkPass(
    queryClient,
    (key) => key?.[0] === 'tasks',
    pass,
    () => isActive,
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  );
  const setActive = (value: boolean) => {
    isActive = value;
    for (const listener of [...listeners]) listener(value);
  };
  const queue = (id: string, key = ['tasks', 'create']) =>
    void new MutationObserver<void, Error, Vars>(queryClient, {
      mutationKey: key,
      networkMode: 'online',
      scope: { id: 'tasks:h' },
      mutationFn: () => new Promise<void>((resolve) => server.answer.push(resolve)),
    })
      .mutate({ id })
      .catch(() => undefined);
  return { queryClient, pass, setActive, queue, server, stop };
}

describe('the network pass for the queue behind (bloque 15.1)', () => {
  beforeEach(() => onlineManager.setOnline(false));
  afterEach(() => onlineManager.setOnline(true));

  it('asks for it when the app goes behind with a change waiting, once', async () => {
    const { pass, setActive, queue } = setup();
    queue('a');
    queue('b');
    await vi.waitFor(() => undefined);
    expect(pass.calls).toEqual([]);
    setActive(false);
    setActive(false);
    expect(pass.calls).toEqual(['hold']);
  });

  it('asks for it when a change is queued with the app already behind', () => {
    const { pass, setActive, queue } = setup();
    setActive(false);
    expect(pass.calls).toEqual([]);
    queue('a');
    expect(pass.calls).toEqual(['hold']);
  });

  it('lets it go as soon as the queue is empty behind', async () => {
    const { pass, setActive, queue, server } = setup();
    queue('a');
    setActive(false);
    onlineManager.setOnline(true);
    await vi.waitFor(() => expect(server.answer).toHaveLength(1));
    server.answer[0]?.();
    await vi.waitFor(() => expect(pass.calls).toEqual(['hold', 'release']));
  });

  it('lets it go when the app comes to the front, and asks again behind', () => {
    const { pass, setActive, queue } = setup();
    queue('a');
    setActive(false);
    setActive(true);
    setActive(false);
    expect(pass.calls).toEqual(['hold', 'release', 'hold']);
  });

  it('never for a change that is not queued (a form that saves online)', () => {
    const { pass, setActive, queue } = setup();
    setActive(false);
    queue('a', ['households', 'rename']);
    expect(pass.calls).toEqual([]);
  });

  it('lets it go when it stops watching', () => {
    const { pass, setActive, queue, stop } = setup();
    queue('a');
    setActive(false);
    stop();
    expect(pass.calls).toEqual(['hold', 'release']);
  });
});
