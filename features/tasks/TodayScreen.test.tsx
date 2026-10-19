import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TodayScreen from '@/app/(tabs)/today';
import { AppError } from '@/data/supabase/errors';
import { addDays, localDateIso } from '@/domain/tasks/dates';
import type { TaskItem } from '@/domain/tasks/views';
import type { Member, Membership } from '@/features/households/api';
import { membersKey, membershipKey } from '@/features/households/keys';
import { t } from '@/i18n';
import { NoticeProvider } from '@/ui/components/Notice';
import { listTasks } from './api';
import { TaskFilterProvider } from './filter';
import { tasksKey } from './queries';

vi.mock('@/features/auth/SessionProvider', () => ({
  useSession: () => ({ status: 'signed-in', userId: 'me' }),
}));
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  listTasks: vi.fn(),
}));

const today = localDateIso(new Date());
const membership: Membership = {
  householdId: 'h',
  householdName: 'Casa',
  role: 'owner',
  rooms: ['kitchen'],
};
const members: Member[] = [
  { userId: 'me', displayName: 'Ana', role: 'owner', joinedAt: '2026-10-01' },
  { userId: 'bo', displayName: 'Bo', role: 'member', joinedAt: '2026-10-02' },
];

function task(id: string, patch: Partial<TaskItem>): TaskItem {
  return {
    id,
    seriesId: `s-${id}`,
    title: id,
    room: null,
    assigneeId: 'me',
    dueOn: today,
    completedAt: null,
    completedBy: null,
    createdBy: 'me',
    createdAt: '2026-10-01T08:00:00.000Z',
    recurrence: null,
    skippedAt: null,
    generatedFrom: null,
    ...patch,
  };
}

/** Hoy with the household cached as the app would have it; `tasks` undefined loads them. */
function renderToday(tasks?: TaskItem[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  queryClient.setQueryData(membershipKey, membership);
  queryClient.setQueryData(membersKey('h'), members);
  if (tasks) queryClient.setQueryData(tasksKey('h'), tasks);
  render(
    <QueryClientProvider client={queryClient}>
      <NoticeProvider>
        <TaskFilterProvider>
          <TodayScreen />
        </TaskFilterProvider>
      </NoticeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(listTasks).mockReset();
});

describe('Hoy', () => {
  it('lists the open tasks for today and says how many are left on the door', () => {
    renderToday([
      task('Fregar', {}),
      task('Barrer', { dueOn: addDays(today, -2) }),
      task('Planchar', { dueOn: addDays(today, 3) }),
    ]);
    expect(screen.getByTestId('task-note.Fregar')).toBeTruthy();
    expect(screen.getByTestId('task-note.Barrer')).toBeTruthy();
    expect(screen.queryByTestId('task-note.Planchar')).toBeNull();
    expect(screen.getByTestId('today.door-line').textContent).not.toBe('');
  });

  it('keeps a task done today out of what is left', () => {
    renderToday([task('Fregar', { completedAt: new Date().toISOString(), completedBy: 'me' })]);
    expect(screen.queryByTestId('task-note.Fregar')).toBeNull();
    expect(screen.getAllByText('Fregar').length).toBeGreaterThan(0);
  });

  it('offers the quick add for today', () => {
    renderToday([]);
    expect(screen.getByTestId('today.quick-add')).toBeTruthy();
  });

  it('shows the load error with its retry when the tasks never loaded', async () => {
    vi.mocked(listTasks).mockRejectedValue(new AppError('NETWORK'));
    renderToday();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(t('tasks.errors.NETWORK'));
    expect(within(document.body).getByRole('button', { name: t('errors.retry') })).toBeTruthy();
  });
});
