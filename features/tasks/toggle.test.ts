import { MutationObserver, onlineManager, QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/data/supabase/errors';
import type { TaskItem } from '@/domain/tasks/views';
import { completeTask, reopenTask } from './api';
import { membershipKey } from '@/features/households/keys';
import { isFresh, takeFresh } from './freshIds';
import { buildToggleOptions, runToggle, type ToggleVars } from './toggle';

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

/** The household and the person ride with each toggle, so a queued one survives a restart. */
const vars = (v: { id: string; done: boolean }): ToggleVars => ({
  householdId: 'h',
  userId: 'me',
  ...v,
});

function setup() {
  const queryClient = new QueryClient();
  // Mounted, as the provider does: it resumes the queue when the connection comes back.
  queryClient.mount();
  const notify = vi.fn();
  // The network retries without their backoff, so a test does not wait for them.
  const options = { ...buildToggleOptions(queryClient, notify), retryDelay: 0 };
  const run = (v: { id: string; done: boolean }) =>
    new MutationObserver(queryClient, options).mutate(vars(v));
  return { queryClient, notify, run, options };
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

afterEach(() => {
  onlineManager.setOnline(true);
});

describe('the time of the tap (bloque 11)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends the time and day it was marked, not the time it reaches the server', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 26, 23, 50));
    const tapped = new Date().toISOString();
    const { queryClient, options } = setup();
    queryClient.setQueryData(key, [a]);
    vi.mocked(completeTask).mockResolvedValue(undefined);
    onlineManager.setOnline(false);
    runToggle(queryClient, options, vars({ id: 'a', done: true }));
    await vi.waitFor(() =>
      expect(queryClient.getQueryData<TaskItem[]>(key)?.[0]?.completedAt).toBe(tapped),
    );

    // The connection is back the next morning.
    vi.setSystemTime(new Date(2026, 9, 27, 8, 0));
    onlineManager.setOnline(true);
    await vi.waitFor(() => expect(completeTask).toHaveBeenCalledTimes(1));
    expect(completeTask).toHaveBeenCalledWith('a', '2026-10-26', tapped);
  });
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
    vi.mocked(completeTask).mockRejectedValue(new AppError('UNKNOWN'));
    await run({ id: 'a', done: true }).catch(() => undefined);
    expect(queryClient.getQueryData(key)).toEqual([a]);
    expect(notify).toHaveBeenCalledWith('No se pudo marcar como hecha. Inténtalo de nuevo.');
  });

  describe('says which action failed and why', () => {
    const doneA: TaskItem = { ...a, completedAt: '2026-10-09T10:00:00.000Z', completedBy: 'me' };

    // Bloque 11 (T1): a request that does not get through is never final: it is tried again,
    // the note stays marked and nothing is said, however long the connection takes.
    it('completing without getting through: keeps trying and says nothing', async () => {
      const { queryClient, notify, run } = setup();
      queryClient.setQueryData(key, [a]);
      vi.mocked(completeTask)
        .mockRejectedValueOnce(new Error('Network request failed'))
        .mockRejectedValueOnce(new Error('Network request failed'))
        .mockResolvedValueOnce(undefined);
      await run({ id: 'a', done: true });
      expect(completeTask).toHaveBeenCalledTimes(3);
      expect(notify).not.toHaveBeenCalled();
      expect(queryClient.getQueryData<TaskItem[]>(key)?.[0]?.completedAt).not.toBeNull();
    });

    it('reopening for an unknown reason', async () => {
      const { queryClient, notify, run } = setup();
      queryClient.setQueryData(key, [doneA]);
      vi.mocked(reopenTask).mockRejectedValue(new AppError('UNKNOWN'));
      await run({ id: 'a', done: false }).catch(() => undefined);
      expect(notify).toHaveBeenCalledWith('No se pudo reabrir. Inténtalo de nuevo.');
    });

    it('reopening without getting through, when the queue gives up anyway (no retries)', async () => {
      const { queryClient, notify, options } = setup();
      queryClient.setQueryData(key, [doneA]);
      vi.mocked(reopenTask).mockRejectedValue(new AppError('NETWORK'));
      await new MutationObserver(queryClient, { ...options, retry: false })
        .mutate(vars({ id: 'a', done: false }))
        .catch(() => undefined);
      expect(notify).toHaveBeenCalledWith(
        'No se pudo reabrir: sin conexión. Inténtalo cuando vuelva.',
      );
    });
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
    // One queue: the second goes once the first settles.
    await vi.waitFor(() => expect(completeTask).toHaveBeenCalledTimes(1));
    d1.resolve();
    await p1;
    expect(spy).toHaveBeenCalledTimes(0);
    await vi.waitFor(() => expect(completeTask).toHaveBeenCalledTimes(2));
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
    await vi.waitFor(() => expect(completeTask).toHaveBeenCalledTimes(1));
    d1.reject(new AppError('UNKNOWN'));
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
      d.reject(new AppError('UNKNOWN'));
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
      expect(notify).toHaveBeenCalledWith('No puedes reabrirla porque la siguiente ya está hecha.');
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

describe('runToggle', () => {
  function setupRun() {
    const queryClient = new QueryClient();
    const options = buildToggleOptions(queryClient, vi.fn());
    return {
      queryClient,
      toggle: (v: { id: string; done: boolean }) => runToggle(queryClient, options, vars(v)),
    };
  }

  it('queues the undo behind a pending complete instead of dropping it', async () => {
    const { queryClient, toggle } = setupRun();
    queryClient.setQueryData(key, [a]);
    const d = deferred();
    vi.mocked(completeTask).mockReturnValue(d.promise);
    vi.mocked(reopenTask).mockResolvedValue(undefined);
    toggle({ id: 'a', done: true });
    await vi.waitFor(() => expect(completeTask).toHaveBeenCalledTimes(1));
    toggle({ id: 'a', done: false });
    // The reopen shows at once, but its request waits for the complete to settle.
    await vi.waitFor(() =>
      expect(queryClient.getQueryData<TaskItem[]>(key)?.[0]?.completedAt).toBeNull(),
    );
    expect(reopenTask).not.toHaveBeenCalled();
    d.resolve();
    await vi.waitFor(() => expect(reopenTask).toHaveBeenCalledWith('a'));
    await vi.waitFor(() => expect(queryClient.isMutating()).toBe(0));
  });

  it('drops a repeated tap while the same toggle is pending', async () => {
    const { queryClient, toggle } = setupRun();
    queryClient.setQueryData(key, [a]);
    const d = deferred();
    vi.mocked(completeTask).mockReturnValue(d.promise);
    toggle({ id: 'a', done: true });
    toggle({ id: 'a', done: true });
    await vi.waitFor(() => expect(completeTask).toHaveBeenCalledTimes(1));
    expect(queryClient.isMutating()).toBe(1);
    d.resolve();
    await vi.waitFor(() => expect(queryClient.isMutating()).toBe(0));
    expect(completeTask).toHaveBeenCalledTimes(1);
  });

  it('marks a completed note as fresh for the tray', () => {
    const { queryClient, toggle } = setupRun();
    queryClient.setQueryData(key, [b]);
    vi.mocked(completeTask).mockResolvedValue(undefined);
    toggle({ id: 'b', done: true });
    expect(isFresh('b', 'done')).toBe(true);
    takeFresh('b', 'done');
  });
});

describe('without a connection (fase 10e)', () => {
  it('marks the note at once and sends it when the connection is back', async () => {
    const { queryClient, run, notify } = setup();
    queryClient.setQueryData(key, [a]);
    vi.mocked(completeTask).mockResolvedValue(undefined);
    onlineManager.setOnline(false);
    void run({ id: 'a', done: true });
    await vi.waitFor(() =>
      expect(queryClient.getQueryData<TaskItem[]>(key)?.[0]?.completedAt).toEqual(
        expect.any(String),
      ),
    );
    expect(completeTask).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    onlineManager.setOnline(true);
    await vi.waitFor(() =>
      expect(completeTask).toHaveBeenCalledWith('a', expect.any(String), undefined),
    );
  });

  it('keeps the queued toggles in order: a reopen goes after its complete', async () => {
    const { queryClient, options } = setup();
    queryClient.setQueryData(key, [a]);
    const order: string[] = [];
    vi.mocked(completeTask).mockImplementation(() => {
      order.push('complete');
      return Promise.resolve();
    });
    vi.mocked(reopenTask).mockImplementation(() => {
      order.push('reopen');
      return Promise.resolve();
    });
    onlineManager.setOnline(false);
    runToggle(queryClient, options, vars({ id: 'a', done: true }));
    runToggle(queryClient, options, vars({ id: 'a', done: false }));
    onlineManager.setOnline(true);
    await vi.waitFor(() => expect(order).toEqual(['complete', 'reopen']));
  });

  it('a complete that fails for good does not undo the «Deshacer» queued behind it', async () => {
    const { queryClient, options } = setup();
    queryClient.setQueryData(key, [a]);
    vi.mocked(completeTask).mockRejectedValue(new AppError('UNKNOWN'));
    vi.mocked(reopenTask).mockResolvedValue(undefined);
    onlineManager.setOnline(false);
    runToggle(queryClient, options, vars({ id: 'a', done: true }));
    runToggle(queryClient, options, vars({ id: 'a', done: false }));
    onlineManager.setOnline(true);
    await vi.waitFor(() => expect(queryClient.isMutating()).toBe(0));
    expect(queryClient.getQueryData<TaskItem[]>(key)?.[0]?.completedAt).toBeNull();
  });
});
