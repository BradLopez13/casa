import { MutationObserver, onlineManager, QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TaskItem } from '@/domain/tasks/views';
import { buildCreateOptions, type CreateVars } from './create';
import { createTask } from './api';
import { pendingTasks, withQueued } from './pending';
import { buildToggleOptions } from './toggle';

vi.mock('./api', () => ({ createTask: vi.fn(), completeTask: vi.fn(), reopenTask: vi.fn() }));

const base: TaskItem = {
  id: 'a',
  seriesId: 'a',
  title: 'Fregar',
  room: null,
  assigneeId: 'me',
  dueOn: '2026-10-22',
  completedAt: null,
  completedBy: null,
  recurrence: null,
  skippedAt: null,
  generatedFrom: null,
  createdBy: 'me',
  createdAt: '2026-10-20T08:00:00.000Z',
};
const created: CreateVars = {
  id: 'n',
  householdId: 'h',
  userId: 'me',
  input: { title: 'Regar', room: null, assigneeId: 'me', dueOn: '2026-10-22', recurrence: null },
};

/** A client offline with a create and a complete waiting in the queue. */
function queued() {
  const queryClient = new QueryClient();
  queryClient.mount();
  onlineManager.setOnline(false);
  queryClient.setQueryData<TaskItem[]>(['tasks', 'h'], [base]);
  void new MutationObserver(queryClient, buildCreateOptions(queryClient, vi.fn()))
    .mutate(created)
    .catch(() => undefined);
  void new MutationObserver(queryClient, buildToggleOptions(queryClient, vi.fn()))
    .mutate({ id: 'a', done: true, householdId: 'h', userId: 'me' })
    .catch(() => undefined);
  return queryClient;
}

afterEach(() => {
  onlineManager.setOnline(true);
});

describe('withQueued (fase 10e)', () => {
  it('keeps what is queued on top of a list from the server that does not have it yet', async () => {
    const queryClient = queued();
    await vi.waitFor(() => expect(queryClient.isMutating()).toBe(2));
    const fromServer = [base];
    const shown = withQueued(queryClient, 'h', fromServer);
    expect(shown.map((t) => t.id)).toEqual(['a', 'n']);
    expect(shown.find((t) => t.id === 'a')?.completedAt).toEqual(expect.any(String));
  });

  it('leaves a list that already has them as it is', async () => {
    const queryClient = queued();
    await vi.waitFor(() => expect(queryClient.isMutating()).toBe(2));
    const fromServer = [
      { ...base, completedAt: '2026-10-22T10:00:00.000Z', completedBy: 'me' },
      { ...base, id: 'n', title: 'Regar' },
    ];
    expect(withQueued(queryClient, 'h', fromServer)).toEqual(fromServer);
  });

  it('only touches the household the queue is for', async () => {
    const queryClient = queued();
    await vi.waitFor(() => expect(queryClient.isMutating()).toBe(2));
    const other = [{ ...base, id: 'x' }];
    expect(withQueued(queryClient, 'other', other)).toBe(other);
  });

  it('still shows a create that reached the server after the list was read', async () => {
    const queryClient = new QueryClient();
    queryClient.mount();
    vi.mocked(createTask).mockResolvedValue('n');
    queryClient.setQueryData<TaskItem[]>(['tasks', 'h'], [base]);
    onlineManager.setOnline(false);
    void new MutationObserver(queryClient, buildCreateOptions(queryClient, vi.fn()))
      .mutate(created)
      .catch(() => undefined);
    await vi.waitFor(() => expect(queryClient.isMutating()).toBe(1));
    const before = pendingTasks(queryClient);
    onlineManager.setOnline(true);
    await vi.waitFor(() => expect(queryClient.isMutating()).toBe(0));
    expect(withQueued(queryClient, 'h', [base], before).map((t) => t.id)).toEqual(['a', 'n']);
  });
});
