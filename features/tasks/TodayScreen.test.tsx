import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TodayScreen from '@/app/(tabs)/today';
import { AppError } from '@/data/supabase/errors';
import { addDays, localDateIso } from '@/domain/tasks/dates';
import type { TaskItem } from '@/domain/tasks/views';
import type { Member, Membership } from '@/features/households/api';
import { membersKey, membershipKey } from '@/features/households/keys';
import { useHint, type HintId } from '@/features/hints/hints';
import { t } from '@/i18n';
import { NoticeProvider } from '@/ui/components/Notice';
import { listTasks } from './api';
import { TaskFilterProvider } from './filter';
import { tasksKey } from './queries';

vi.mock('@/features/auth/SessionProvider', () => ({
  useSession: () => ({ status: 'signed-in', userId: 'me' }),
}));
vi.mock('@/features/hints/hints', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/hints/hints')>()),
  useHint: vi.fn(() => false),
}));
vi.mock('@/ui/a11y', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/ui/a11y')>()),
  useScreenReader: () => false,
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

/** A phone held upright: one column, so the door sits in the refreshing list with its handle. */
function phoneSize() {
  // react-native-web measures the document element, which jsdom leaves at 0 x 0.
  const root = document.documentElement;
  Object.defineProperty(root, 'clientWidth', { value: 400, configurable: true });
  Object.defineProperty(root, 'clientHeight', { value: 860, configurable: true });
  window.dispatchEvent(new Event('resize'));
}

/** Which hints this device has not used yet. */
function hintsOpen(...open: HintId[]) {
  vi.mocked(useHint).mockImplementation((id) => open.includes(id));
}

beforeEach(() => {
  vi.mocked(listTasks).mockReset();
  hintsOpen();
  onlineManager.setOnline(true);
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

  it('on a new device, points at the box above the first note only', () => {
    hintsOpen('complete', 'swipe');
    renderToday([task('Fregar', {}), task('Barrer', {})]);
    expect(screen.getAllByTestId('tasks.complete-hint')).toHaveLength(1);
    expect(screen.queryByTestId('tasks.swipe-hint')).toBeNull();
  });

  it('once the box is known, teaches the swipe in its place', () => {
    hintsOpen('swipe');
    renderToday([task('Fregar', {})]);
    expect(screen.queryByTestId('tasks.complete-hint')).toBeNull();
    expect(screen.getByTestId('tasks.swipe-hint').textContent).toContain(t('tasks.swipeHint'));
  });

  it('shows what the quick add understands while the field is empty', () => {
    hintsOpen('quickAdd');
    renderToday([]);
    const hint = screen.getByTestId('today.quick-add.hint');
    // The example uses someone of the household.
    expect(hint.textContent).toContain('@Bo');
    fireEvent.change(screen.getByTestId('today.quick-add'), { target: { value: 'Regar' } });
    expect(screen.queryByTestId('today.quick-add.hint')).toBeNull();
  });

  it('offers task ideas when there is nothing to do today', () => {
    renderToday([task('Planchar', { dueOn: addDays(today, 3) })]);
    expect(screen.getByTestId('tasks.ideas')).toBeTruthy();
  });

  it('offline, the box says so before touching the task', () => {
    renderToday([task('Fregar', {})]);
    onlineManager.setOnline(false);
    fireEvent.click(screen.getByTestId('task-note.Fregar.toggle'));
    expect(screen.getByText(t('tasks.completeOffline'))).toBeTruthy();
    expect(screen.queryByText(t('tasks.done'))).toBeNull();
    expect(screen.getByTestId('task-note.Fregar')).toBeTruthy();
  });

  it('keeps the door handle hint back while the box one shows', () => {
    phoneSize();
    hintsOpen('refresh', 'complete');
    renderToday([task('Fregar', {})]);
    expect(screen.queryByTestId('door.refresh-hint')).toBeNull();
  });

  it('shows the door handle hint when the box is already known', () => {
    phoneSize();
    hintsOpen('refresh');
    renderToday([task('Fregar', {})]);
    expect(screen.getByTestId('door.refresh-hint').textContent).toContain(t('refresh.hint'));
  });

  it('keeps the door handle hint back while the quick add one shows', () => {
    phoneSize();
    hintsOpen('refresh', 'quickAdd');
    renderToday([task('Fregar', {})]);
    expect(screen.queryByTestId('door.refresh-hint')).toBeNull();
  });
});
