import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { router } from 'expo-router';
import TasksScreen from '@/app/(tabs)/tasks';
import { AppError } from '@/data/supabase/errors';
import { addDays } from '@/domain/tasks/dates';
import type { TaskItem } from '@/domain/tasks/views';
import type { Member, Membership } from '@/features/households/api';
import { membersKey, membershipKey } from '@/features/households/keys';
import { t } from '@/i18n';
import { NoticeProvider } from '@/ui/components/Notice';
import { listTasks } from './api';
import { TaskFilterProvider } from './filter';
import { tasksKey } from './keys';

vi.mock('@/features/auth/SessionProvider', () => ({
  useSession: () => ({ status: 'signed-in', userId: 'me' }),
}));
vi.mock('@/features/hints/hints', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/hints/hints')>()),
  useHint: () => false,
}));
vi.mock('@/ui/a11y', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/ui/a11y')>()),
  useScreenReader: () => false,
}));
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  listTasks: vi.fn(),
}));

// A Thursday, so «Esta semana» has days after today and before Sunday.
const today = '2026-10-22';
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

/** Tareas with the household cached; `tasks` undefined loads them through `listTasks`. */
function renderTasks(tasks?: TaskItem[]) {
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
          <TasksScreen />
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

/** The list's section headings, in order, without their counts (each title once). */
function sectionTitles(): string[] {
  const titles = screen
    .getAllByRole('heading')
    .map((h) => h.getAttribute('aria-label'))
    .filter((label): label is string => label !== null)
    .map((label) => label.replace(/, \d+ tareas?$/, ''));
  return [...new Set(titles)];
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 22, 10, 0));
  vi.mocked(listTasks).mockReset();
  vi.mocked(router.push).mockClear();
  onlineManager.setOnline(true);
  // A phone held upright: one column.
  windowSize(400, 860);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Tareas', () => {
  // Bloque 11 (11.2): at large text the day pills sit beside the door's magnets, so only the quick
  // add stands between the door and the first note; at the default text they stay under the field.
  it('at large text brings the day pills into the compact door, above the quick add', async () => {
    const { Dimensions } = await import('react-native');
    const get = Dimensions.get.bind(Dimensions);
    const scale = vi
      .spyOn(Dimensions, 'get')
      .mockImplementation((dim) => ({ ...get(dim), fontScale: 1.6 }));
    renderTasks([task('Fregar', {})]);
    const pills = screen.getByTestId('tasks.pill.all');
    const field = screen.getByTestId('tasks.quick-add');
    expect(pills.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    scale.mockRestore();
  });

  it('at the default text keeps the day pills under the quick add', () => {
    renderTasks([task('Fregar', {})]);
    const pills = screen.getByTestId('tasks.pill.all');
    const field = screen.getByTestId('tasks.quick-add');
    expect(field.compareDocumentPosition(pills) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // Bloque 11 (11.6): Tareas opens the form for the chosen day (none on «Todas»), for no one yet.
  it('with the field empty, the «+» opens the new task form for the chosen day', () => {
    renderTasks([task('Fregar', {})]);
    fireEvent.click(screen.getByTestId('tasks.quick-add.submit'));
    expect(vi.mocked(router.push)).toHaveBeenLastCalledWith({
      pathname: '/task/new',
      params: { due: 'none' },
    });
    fireEvent.click(screen.getByTestId(`tasks.pill.${today}`));
    fireEvent.click(screen.getByTestId('tasks.quick-add.submit'));
    expect(vi.mocked(router.push)).toHaveBeenLastCalledWith({
      pathname: '/task/new',
      params: { due: today },
    });
  });

  it('the door line starts by saying what the tab is for', () => {
    renderTasks([task('Fregar', {})]);
    const line = screen.getByText((text) => text.startsWith(t('tasks.allLine.purpose')));
    expect(line.textContent?.startsWith('Todo lo del hogar, por día.')).toBe(true);
  });

  // The list draws its first rows only (no layout in jsdom), so the five groups go in two renders.
  it('«Todas» groups what is pending by date: earlier days, today, this week', () => {
    renderTasks([
      task('Tender', { dueOn: addDays(today, 2) }),
      task('Barrer', { dueOn: addDays(today, -2) }),
      task('Fregar', {}),
    ]);
    expect(sectionTitles()).toEqual(['De días anteriores', 'Hoy', 'Esta semana']);
    expect(sectionTitles()).toEqual([
      t('tasks.section.overdue'),
      t('tasks.section.allToday'),
      t('tasks.section.thisWeek'),
    ]);
    for (const id of ['Tender', 'Barrer', 'Fregar'])
      expect(screen.getByTestId(`task-note.${id}`)).toBeTruthy();
  });

  it('«Todas» puts later days after Sunday, then what has no date', () => {
    renderTasks([task('Regar', { dueOn: null }), task('Planchar', { dueOn: addDays(today, 10) })]);
    expect(sectionTitles()).toEqual([t('tasks.section.later'), t('tasks.section.undated')]);
    expect(sectionTitles()).toEqual(['Más adelante', 'Sin fecha']);
  });

  it('names its controls: the quick add, the filters and each note’s box', () => {
    renderTasks([task('Fregar', {})]);
    const field = screen.getByTestId('tasks.quick-add');
    expect(field.getAttribute('placeholder')).toBe(t('tasks.quickAddUndated'));
    expect(t('tasks.quickAddUndated')).toBe('Tarea para ti, sin fecha…');
    expect(screen.getByRole('radiogroup', { name: t('tasks.filterLabel') })).toBeTruthy();
    expect(screen.getByRole('radio', { name: t('tasks.filterAll') })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: t('tasks.pill.label') })).toBeTruthy();
    expect(screen.getByRole('radio', { name: t('tasks.pill.allLabel') })).toBeTruthy();
    expect(
      screen
        .getByRole('checkbox', { name: t('tasks.a11y.complete', { title: 'Fregar' }) })
        .getAttribute('aria-checked'),
    ).toBe('false');
    expect(
      screen.getByRole('radio', { name: t('tasks.pill.allLabel') }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(screen.getByRole('button', { name: t('tasks.ideas') })).toBeTruthy();
  });

  it('while the tasks load, shows a spinner and no empty text', () => {
    vi.mocked(listTasks).mockReturnValue(new Promise(() => undefined));
    renderTasks();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByText(t('tasks.empty'))).toBeNull();
  });

  it('when the tasks never loaded, shows the error with «Reintentar», which loads again', async () => {
    vi.mocked(listTasks).mockRejectedValue(new AppError('NETWORK'));
    onlineManager.setOnline(false);
    renderTasks();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(t('tasks.errors.NETWORK'));
    vi.mocked(listTasks).mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: t('errors.retry') }));
    await vi.waitFor(() => expect(screen.getByText(t('tasks.empty'))).toBeTruthy());
    expect(listTasks).toHaveBeenCalledTimes(2);
  });

  it('empty, links to the help on how to write a task', () => {
    renderTasks([]);
    expect(screen.getByText(t('tasks.empty'))).toBeTruthy();
    const help = screen.getByTestId('tasks.help');
    expect(help.getAttribute('aria-label')).toBe(t('help.link'));
    fireEvent.click(help);
    expect(vi.mocked(router.push)).toHaveBeenCalledWith('/help?entry=write');
  });

  it('offline with tasks cached, says it shows the last ones it got', () => {
    onlineManager.setOnline(false);
    renderTasks([task('Fregar', {})]);
    expect(screen.getByTestId('tasks.offline').getAttribute('aria-label')).toBe(
      t('offline.showingLast'),
    );
    expect(screen.getByTestId('task-note.Fregar')).toBeTruthy();
  });

  it('online, there is no offline band', () => {
    renderTasks([task('Fregar', {})]);
    expect(screen.queryByTestId('tasks.offline')).toBeNull();
  });
});
