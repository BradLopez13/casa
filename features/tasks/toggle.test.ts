import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/data/supabase/errors';
import type { TaskItem } from '@/domain/tasks/views';
import { completeTask, reopenTask } from './api';
import { membershipKey } from '@/features/households/keys';
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
  recurrence: null,
  skippedAt: null,
  generatedFrom: null,
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

  it('rolls back only the failed task, keeping other toggles', async () => {
    const { queryClient, run } = setup();
    queryClient.setQueryData(key, [a, b]);
    const d1 = deferred();
    const d2 = deferred();
    vi.mocked(completeTask).mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise);
    const p1 = run({ id: 'a', done: true }).catch(() => undefined);
    const p2 = run({ id: 'b', done: true });
    await vi.waitFor(() => expect(completeTask).toHaveBeenCalledTimes(2));
    d1.reject(new AppError('NETWORK'));
    await p1;
    const list = queryClient.getQueryData<TaskItem[]>(key);
    expect(list?.find((t) => t.id === 'a')?.completedAt).toBeNull();
    expect(list?.find((t) => t.id === 'b')?.completedAt).not.toBeNull();
    d2.resolve();
    await p2;
  });

  describe('recurring', () => {
    const daily: TaskItem = {
      ...a,
      id: 'r',
      dueOn: '2026-10-09',
      recurrence: { kind: 'interval', every: 1 },
    };
    const doneDaily: TaskItem = {
      ...daily,
      completedAt: '2026-10-09T10:00:00.000Z',
      completedBy: 'me',
    };
    const next: TaskItem = { ...daily, id: 'n', dueOn: '2026-10-10', generatedFrom: 'r' };

    it('drops the provisional next one and reopens the original when completing fails', async () => {
      const { queryClient, run } = setup();
      queryClient.setQueryData(key, [daily, b]);
      const d = deferred();
      vi.mocked(completeTask).mockReturnValue(d.promise);
      const pending = run({ id: 'r', done: true }).catch(() => undefined);
      await vi.waitFor(() => expect(queryClient.getQueryData<TaskItem[]>(key)).toHaveLength(3));
      d.reject(new AppError('NETWORK'));
      await pending;
      expect(queryClient.getQueryData(key)).toEqual([daily, b]);
    });

    it('brings back the next one when reopening fails with ALREADY_ADVANCED', async () => {
      const { queryClient, notify, run } = setup();
      queryClient.setQueryData(key, [doneDaily, next, b]);
      const d = deferred();
      vi.mocked(reopenTask).mockReturnValue(d.promise);
      const pending = run({ id: 'r', done: false }).catch(() => undefined);
      await vi.waitFor(() => expect(queryClient.getQueryData<TaskItem[]>(key)).toHaveLength(2));
      d.reject(new AppError('ALREADY_ADVANCED'));
      await pending;
      const list = queryClient.getQueryData<TaskItem[]>(key);
      expect(list).toContainEqual(next);
      expect(list?.find((t) => t.id === 'r')).toEqual(doneDaily);
      expect(notify).toHaveBeenCalledWith('La siguiente ya está hecha; no se puede reabrir esta.');
    });

    it('explains INVALID_TODAY', async () => {
      const { queryClient, notify, run } = setup();
      queryClient.setQueryData(key, [daily]);
      vi.mocked(completeTask).mockRejectedValue(new AppError('INVALID_TODAY'));
      await run({ id: 'r', done: true }).catch(() => undefined);
      expect(notify).toHaveBeenCalledWith(
        'La fecha del móvil no parece correcta. Revísala e inténtalo de nuevo.',
      );
    });
  });

  it('invalidates tasks, membership and members on TASK_NOT_FOUND', async () => {
    const { queryClient, run } = setup();
    queryClient.setQueryData(key, [a]);
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(completeTask).mockRejectedValue(new AppError('TASK_NOT_FOUND'));
    await run({ id: 'a', done: true }).catch(() => undefined);
    const keys = spy.mock.calls.map((c) => c[0]?.queryKey);
    expect(keys).toContainEqual(['tasks']);
    expect(keys).toContainEqual(membershipKey);
    expect(keys).toContainEqual(['members']);
  });
});
