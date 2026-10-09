import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/data/supabase/errors';
import type { TaskItem } from '@/domain/tasks/views';
import { completeTask, reopenTask } from './api';
import { buildToggleOptions } from './toggle';

vi.mock('./api', () => ({ completeTask: vi.fn(), reopenTask: vi.fn() }));

const a: TaskItem = {
  id: 'a',
  seriesId: 's',
  title: 'A',
  room: null,
  assigneeId: null,
  dueOn: null,
  completedAt: null,
  completedBy: null,
  createdBy: null,
  createdAt: '2026-10-01T00:00:00.000Z',
};
const b: TaskItem = { ...a, id: 'b', title: 'B' };
const key = ['tasks', 'h'];

function setup() {
  const queryClient = new QueryClient();
  const notify = vi.fn();
  const options = buildToggleOptions(queryClient, 'h', 'me', notify);
  const run = (vars: { id: string; done: boolean }) =>
    new MutationObserver(queryClient, options).mutate(vars);
  return { queryClient, notify, run };
}

const deferred = () => {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

beforeEach(() => {
  vi.mocked(completeTask).mockReset();
  vi.mocked(reopenTask).mockReset();
});

describe('buildToggleOptions', () => {
  it('moves the task in the cache before the server answers', async () => {
    const { queryClient, run } = setup();
    queryClient.setQueryData(key, [a]);
    const d = deferred();
    vi.mocked(completeTask).mockReturnValue(d.promise);
    const pending = run({ id: 'a', done: true });
    await vi.waitFor(() => {
      const list = queryClient.getQueryData<TaskItem[]>(key);
      expect(list?.[0]?.completedAt).not.toBeNull();
    });
    d.resolve();
    await pending;
  });

  it('restores the cache and notifies when the server fails', async () => {
    const { queryClient, notify, run } = setup();
    queryClient.setQueryData(key, [a]);
    vi.mocked(completeTask).mockRejectedValue(new AppError('NETWORK'));
    await run({ id: 'a', done: true }).catch(() => undefined);
    expect(queryClient.getQueryData(key)).toEqual([a]);
    expect(notify).toHaveBeenCalledWith('No se pudo completar. Inténtalo de nuevo.');
  });

  it('reopens through reopenTask', async () => {
    const { queryClient, run } = setup();
    queryClient.setQueryData(key, [
      { ...a, completedAt: '2026-10-09T10:00:00.000Z', completedBy: 'me' },
    ]);
    vi.mocked(reopenTask).mockResolvedValue(undefined);
    await run({ id: 'a', done: false });
    expect(reopenTask).toHaveBeenCalledWith('a');
  });

  it('refetches only after the last toggle in flight settles', async () => {
    const { queryClient, run } = setup();
    queryClient.setQueryData(key, [a, b]);
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const d1 = deferred();
    const d2 = deferred();
    vi.mocked(completeTask).mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise);
    const p1 = run({ id: 'a', done: true });
    const p2 = run({ id: 'b', done: true });
    await vi.waitFor(() => expect(completeTask).toHaveBeenCalledTimes(2));
    d1.resolve();
    await p1;
    expect(spy).toHaveBeenCalledTimes(0);
    d2.resolve();
    await p2;
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
