import {
  dehydrate,
  hydrate,
  MutationObserver,
  onlineManager,
  QueryClient,
  type DehydratedState,
} from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppError } from '@/data/supabase/errors';
import { persistDehydrateOptions, shouldQueueMutation } from '@/features/offline/persistence';
import type { TaskItem } from '@/domain/tasks/views';
import { completeTask, createTask, reopenTask } from './api';
import { buildCreateOptions, CREATE_KEY, type CreateVars } from './create';
import { tasksKey } from './keys';
import { resumeTasksQueue } from './offline';
import { buildToggleOptions, TOGGLE_KEY, type ToggleVars } from './toggle';

vi.mock('./api', () => ({ createTask: vi.fn(), completeTask: vi.fn(), reopenTask: vi.fn() }));

/** What a restart finds on the device: the cache, and the queue under its own key (bloque 13). */
const onTheDevice = { ...persistDehydrateOptions, shouldDehydrateMutation: shouldQueueMutation };
vi.mock('@/features/shopping/api', () => ({
  addShoppingItem: vi.fn(),
  setItemBought: vi.fn(),
  updateShoppingItem: vi.fn(),
}));

const key = tasksKey('h');
const created: CreateVars = {
  id: 'n',
  householdId: 'h',
  userId: 'me',
  input: { title: 'Regar', room: null, assigneeId: 'me', dueOn: '2026-10-22', recurrence: null },
};

/** A client as the app sets it up: the queue's functions registered before the cache comes back. */
function setup() {
  const queryClient = new QueryClient();
  queryClient.mount();
  const notify = vi.fn();
  queryClient.setMutationDefaults(TOGGLE_KEY, buildToggleOptions(queryClient, notify));
  queryClient.setMutationDefaults(CREATE_KEY, buildCreateOptions(queryClient, notify));
  return { queryClient, notify };
}

/** What the persister writes and reads back: a JSON round trip of the dehydrated cache. */
function restart(from: QueryClient) {
  const saved = JSON.parse(JSON.stringify(dehydrate(from, onTheDevice))) as DehydratedState;
  const next = setup();
  hydrate(next.queryClient, saved);
  return next;
}

beforeEach(() => {
  vi.mocked(createTask).mockReset();
  vi.mocked(completeTask).mockReset();
  vi.mocked(reopenTask).mockReset();
});

afterEach(() => {
  onlineManager.setOnline(true);
});

describe('the task queue after a restart (fase 10e)', () => {
  it('keeps the tasks and sends what was queued offline, in order', async () => {
    const before = setup();
    before.queryClient.setQueryData<TaskItem[]>(key, []);
    onlineManager.setOnline(false);
    void new MutationObserver<string, AppError, CreateVars>(before.queryClient, {
      mutationKey: CREATE_KEY,
    })
      .mutate(created)
      .catch(() => undefined);
    void new MutationObserver<void, AppError, ToggleVars>(before.queryClient, {
      mutationKey: TOGGLE_KEY,
    })
      .mutate({ id: 'n', done: true, householdId: 'h', userId: 'me' })
      .catch(() => undefined);
    await vi.waitFor(() =>
      expect(before.queryClient.getQueryData<TaskItem[]>(key)?.[0]?.completedAt).toEqual(
        expect.any(String),
      ),
    );

    const after = restart(before.queryClient);
    // The app that built the queue is gone.
    before.queryClient.unmount();
    // The list comes back as it was left, the new note done.
    expect(after.queryClient.getQueryData<TaskItem[]>(key)?.map((t) => t.id)).toEqual(['n']);
    const order: string[] = [];
    vi.mocked(createTask).mockImplementation(() => {
      order.push('create');
      return Promise.resolve('n');
    });
    vi.mocked(completeTask).mockImplementation(() => {
      order.push('complete');
      return Promise.resolve();
    });
    onlineManager.setOnline(true);
    await resumeTasksQueue(after.queryClient);
    expect(order).toEqual(['create', 'complete']);
  });

  it('drops a restored task mutation this build does not queue, so it cannot block the rest', async () => {
    const { queryClient } = setup();
    const cache = queryClient.getMutationCache();
    cache.build(queryClient, { mutationKey: ['tasks', 'skip'], scope: { id: 'tasks' } }, {
      status: 'pending',
    } as never);
    await resumeTasksQueue(queryClient);
    expect(cache.findAll({ mutationKey: ['tasks', 'skip'] })).toEqual([]);
  });
});
