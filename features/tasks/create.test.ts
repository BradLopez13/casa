import { MutationObserver, onlineManager, QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/data/supabase/errors';
import type { TaskItem } from '@/domain/tasks/views';
import { createTask } from './api';
import { buildCreateOptions, type CreateVars } from './create';
import { tasksKey } from './keys';

vi.mock('./api', () => ({ createTask: vi.fn() }));

const key = tasksKey('h');
const vars: CreateVars = {
  id: 'new',
  householdId: 'h',
  userId: 'me',
  input: { title: 'Regar', room: null, assigneeId: 'me', dueOn: '2026-10-22', recurrence: null },
};

function setup() {
  const queryClient = new QueryClient();
  queryClient.mount();
  const notify = vi.fn();
  const options = { ...buildCreateOptions(queryClient, notify), retryDelay: 0 };
  const run = () => new MutationObserver(queryClient, options).mutate(vars);
  return { queryClient, notify, run };
}

beforeEach(() => {
  vi.mocked(createTask).mockReset();
});
afterEach(() => {
  onlineManager.setOnline(true);
});

describe('creating a task, queued like a shopping add (fase 10e)', () => {
  it('puts the note in the list at once, as the person wrote it', async () => {
    const { queryClient, run } = setup();
    queryClient.setQueryData<TaskItem[]>(key, []);
    vi.mocked(createTask).mockResolvedValue('new');
    void run();
    await vi.waitFor(() =>
      expect(queryClient.getQueryData<TaskItem[]>(key)).toEqual([
        expect.objectContaining({ id: 'new', title: 'Regar', assigneeId: 'me', createdBy: 'me' }),
      ]),
    );
  });

  it('offline, waits for the connection and then sends it with its own id', async () => {
    const { queryClient, run, notify } = setup();
    queryClient.setQueryData<TaskItem[]>(key, []);
    vi.mocked(createTask).mockResolvedValue('new');
    onlineManager.setOnline(false);
    void run();
    await vi.waitFor(() => expect(queryClient.getQueryData<TaskItem[]>(key)).toHaveLength(1));
    expect(createTask).not.toHaveBeenCalled();
    onlineManager.setOnline(true);
    await vi.waitFor(() => expect(createTask).toHaveBeenCalledWith('new', 'h', vars.input));
    expect(notify).not.toHaveBeenCalled();
  });

  it('a final error takes the note out and says so', async () => {
    const { queryClient, run, notify } = setup();
    queryClient.setQueryData<TaskItem[]>(key, []);
    vi.mocked(createTask).mockImplementation(() => Promise.reject(new AppError('UNKNOWN')));
    await run().catch(() => undefined);
    expect(queryClient.getQueryData<TaskItem[]>(key)).toEqual([]);
    expect(notify).toHaveBeenCalledTimes(1);
  });
});
