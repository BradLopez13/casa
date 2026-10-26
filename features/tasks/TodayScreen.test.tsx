import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { router } from 'expo-router';
import TodayScreen from '@/app/(tabs)/today';
import { AppError } from '@/data/supabase/errors';
import { addDays, localDateIso } from '@/domain/tasks/dates';
import { longDateLabel } from '@/domain/tasks/labels';
import type { TaskItem } from '@/domain/tasks/views';
import type { Member, Membership } from '@/features/households/api';
import { membersKey, membershipKey } from '@/features/households/keys';
import { useHint, type HintId } from '@/features/hints/hints';
import { t } from '@/i18n';
import { NoticeProvider } from '@/ui/components/Notice';
import { createTask, listTasks } from './api';
import { TaskFilterProvider } from './filter';
import { deleteWithUndo, showTask } from './deferredDelete';
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
  createTask: vi.fn(),
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

/** The window at `width` × `height`: react-native-web measures the document element. */
function windowSize(width: number, height: number) {
  const root = document.documentElement;
  Object.defineProperty(root, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(root, 'clientHeight', { value: height, configurable: true });
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
}

/** A phone held upright: one column, so the door sits in the refreshing list with its handle. */
function phoneSize() {
  windowSize(400, 860);
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

  // Fase 10f: the date is part of the door's label, in its style, not a muted aside at the right.
  it('says the date inside the door label, read as one header', () => {
    phoneSize();
    renderToday([]);
    const header = screen.getByRole('heading', {
      name: `${t('today.title')}, ${longDateLabel(today)}`,
    });
    expect(header.textContent).toBe(`${t('today.title')}\u00A0· ${longDateLabel(today)}`);
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
    // Offline the load is tried once and not again (fase 10e): the error shows at once.
    onlineManager.setOnline(false);
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
    phoneSize();
    renderToday([]);
    const hint = screen.getByTestId('today.quick-add.hint');
    // The example uses someone of the household.
    expect(hint.textContent).toContain('@Bo');
    fireEvent.change(screen.getByTestId('today.quick-add'), { target: { value: 'Regar' } });
    expect(screen.queryByTestId('today.quick-add.hint')).toBeNull();
  });

  it('in a compact door (a phone on its side) the example is a short one, whole on one line', () => {
    hintsOpen('quickAdd');
    windowSize(817, 375);
    renderToday([]);
    const hint = screen.getByTestId('today.quick-add.hint');
    expect(hint.textContent).toContain(t('tasks.quickHint.exampleShort'));
    expect(hint.textContent).not.toContain('@');
    expect(getComputedStyle(hint).textOverflow).toBe('ellipsis');
  });

  it('does not celebrate the last pending task deleted while its «Deshacer» is up', () => {
    phoneSize();
    renderToday([task('Fregar', {}), task('Barrer', { completedAt: new Date().toISOString() })]);
    act(() =>
      deleteWithUndo({
        id: 'Fregar',
        remove: () => new Promise(() => undefined),
        notify: () => undefined,
        ms: null,
        schedule: () => () => undefined,
        watchBackground: () => () => undefined,
      }),
    );
    expect(screen.queryByTestId('task-note.Fregar')).toBeNull();
    expect(screen.queryByText(t('today.line.allDone'))).toBeNull();
    expect(screen.queryByText(t('today.nothing'))).toBeNull();
    // Undone: the task is back and the door still counts it.
    act(() => showTask('Fregar'));
    expect(screen.getByTestId('task-note.Fregar')).toBeTruthy();
    expect(screen.queryByText(t('today.line.allDone'))).toBeNull();
  });

  it('links an empty Hoy to the help, on the entry that tells Hoy from Tareas (fase 10d)', () => {
    renderToday([]);
    fireEvent.click(screen.getByTestId('today.help'));
    expect(vi.mocked(router.push)).toHaveBeenCalledWith('/help?entry=tabs');
  });

  it('two quick taps on «+» send the task once (fase 10e)', async () => {
    vi.mocked(createTask).mockResolvedValue('x');
    renderToday([]);
    fireEvent.change(screen.getByTestId('today.quick-add'), { target: { value: 'Regar' } });
    const add = screen.getByTestId('today.quick-add.submit');
    fireEvent.click(add);
    fireEvent.click(add);
    // The note is there at once, before the server answers.
    expect(await screen.findByText('Regar')).toBeTruthy();
    await vi.waitFor(() => expect(createTask).toHaveBeenCalled());
    expect(createTask).toHaveBeenCalledTimes(1);
  });

  // Bloque 11 (11.6): with the field empty the «+» opens the full form, for today and for you.
  it('with the field empty, the «+» opens the new task form for today and for you', () => {
    vi.mocked(router.push).mockClear();
    renderToday([task('Fregar', {})]);
    const add = screen.getByTestId('today.quick-add.submit');
    expect(add.getAttribute('aria-label')).toBe(t('tasks.a11y.addMore'));
    fireEvent.click(add);
    expect(vi.mocked(router.push)).toHaveBeenCalledWith({
      pathname: '/task/new',
      params: { due: today, assignee: 'me' },
    });
  });

  it('with something typed, the «+» adds it and is named so', () => {
    renderToday([task('Fregar', {})]);
    fireEvent.change(screen.getByTestId('today.quick-add'), { target: { value: 'Regar' } });
    expect(screen.getByTestId('today.quick-add.submit').getAttribute('aria-label')).toBe(
      t('tasks.a11y.addButton'),
    );
  });

  it('offers task ideas when there is nothing to do today', () => {
    renderToday([task('Planchar', { dueOn: addDays(today, 3) })]);
    expect(screen.getByTestId('tasks.ideas')).toBeTruthy();
  });

  it('offline, the box marks the task at once and offers «Deshacer», as the shopping does', () => {
    renderToday([task('Fregar', {})]);
    onlineManager.setOnline(false);
    fireEvent.click(screen.getByTestId('task-note.Fregar.toggle'));
    // Sent when the connection is back (fase 10e): no warning, the usual notice.
    expect(screen.getByText(t('tasks.done'))).toBeTruthy();
  });

  it('offline, the done note says it is not sent yet, as a shopping row does (bloque 11)', async () => {
    renderToday([task('Fregar', {})]);
    onlineManager.setOnline(false);
    fireEvent.click(screen.getByTestId('task-note.Fregar.toggle'));
    const mark = await screen.findByTestId('done-tray.Fregar.pending');
    expect(mark.getAttribute('aria-label')).toBe(t('shopping.pending'));
    expect(screen.getByTestId('done-tray.Fregar').getAttribute('aria-label')).toContain(
      t('shopping.pending').toLowerCase(),
    );
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

  it('with large text, the door handle hint does not wait for a quick add hint kept quiet', async () => {
    const { Dimensions } = await import('react-native');
    const get = Dimensions.get.bind(Dimensions);
    const scale = vi
      .spyOn(Dimensions, 'get')
      .mockImplementation((dim) => ({ ...get(dim), fontScale: 1.3 }));
    // A tall one-column window: at ×1.3 its door is still the full one, with the handle.
    windowSize(600, 1100);
    hintsOpen('refresh', 'quickAdd');
    renderToday([task('Fregar', {})]);
    expect(screen.getByTestId('door.refresh-hint')).toBeTruthy();
    scale.mockRestore();
    phoneSize();
  });

  it('with large text and an empty list, the quick add hint comes back', async () => {
    const { Dimensions } = await import('react-native');
    const get = Dimensions.get.bind(Dimensions);
    const scale = vi
      .spyOn(Dimensions, 'get')
      .mockImplementation((dim) => ({ ...get(dim), fontScale: 1.6 }));
    hintsOpen('quickAdd', 'complete');
    renderToday([]);
    expect(screen.getByTestId('today.quick-add.hint')).toBeTruthy();
    scale.mockRestore();
  });

  it('with large text and notes, the quick add hint keeps quiet', async () => {
    const { Dimensions } = await import('react-native');
    const get = Dimensions.get.bind(Dimensions);
    const scale = vi
      .spyOn(Dimensions, 'get')
      .mockImplementation((dim) => ({ ...get(dim), fontScale: 1.6 }));
    hintsOpen('quickAdd', 'swipe');
    renderToday([task('Fregar', {})]);
    expect(screen.getByTestId('tasks.swipe-hint')).toBeTruthy();
    expect(screen.queryByTestId('today.quick-add.hint')).toBeNull();
    scale.mockRestore();
  });
});
