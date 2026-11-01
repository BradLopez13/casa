import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EditTaskRoute from '@/app/task/[id]';
import { AppError } from '@/data/supabase/errors';
import { localDateIso } from '@/domain/tasks/dates';
import type { TaskItem } from '@/domain/tasks/views';
import type { Member, Membership } from '@/features/households/api';
import { membersKey, membershipKey } from '@/features/households/keys';
import { t } from '@/i18n';
import { NoticeProvider } from '@/ui/components/Notice';
import { deleteTask, listTasks, updateTask } from './api';
import { showTask } from './deferredDelete';
import { tasksKey } from './keys';

// The sheet reads its id from the route, and closes through `navigation.isFocused()`.
const nav = vi.hoisted(() => {
  const params: Record<string, string> = { id: 'Fregar' };
  return {
    router: { push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: () => true },
    params,
  };
});
vi.mock('expo-router', () => ({
  useRouter: () => nav.router,
  router: nav.router,
  useNavigation: () => ({
    addListener: () => () => undefined,
    dispatch: vi.fn(),
    isFocused: () => true,
  }),
  useLocalSearchParams: () => nav.params,
  useFocusEffect: () => undefined,
  useSegments: () => [],
  useIsFocused: () => true,
}));
vi.mock('@/features/auth/SessionProvider', () => ({
  useSession: () => ({ status: 'signed-in', userId: 'me' }),
}));
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  listTasks: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
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

function task(id: string, patch: Partial<TaskItem> = {}): TaskItem {
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

/** The task's sheet with the household cached; `tasks` undefined loads them. */
function renderSheet(tasks?: TaskItem[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  queryClient.setQueryData(membershipKey, membership);
  queryClient.setQueryData(membersKey('h'), members);
  if (tasks) queryClient.setQueryData(tasksKey('h'), tasks);
  render(
    <QueryClientProvider client={queryClient}>
      <NoticeProvider>
        <EditTaskRoute />
      </NoticeProvider>
    </QueryClientProvider>,
  );
}

const disabled = (testID: string) => screen.getByTestId(testID).getAttribute('aria-disabled');

beforeEach(() => {
  vi.mocked(listTasks).mockReset();
  vi.mocked(updateTask).mockReset();
  vi.mocked(deleteTask).mockReset().mockResolvedValue(undefined);
  nav.router.back.mockClear();
  nav.params = { id: 'Fregar' };
  showTask('Fregar');
  onlineManager.setOnline(true);
});

describe('Hoja de tarea', () => {
  it('names its controls: title field, Guardar, Cancelar, complete and delete', () => {
    renderSheet([task('Fregar')]);
    expect(screen.getAllByText(t('taskForm.editTitle')).length).toBeGreaterThan(0);
    expect(screen.getByTestId<HTMLInputElement>('task-form.title').value).toBe('Fregar');
    expect(screen.getByRole('button', { name: t('taskForm.save') })).toBeTruthy();
    expect(screen.getByRole('button', { name: t('taskForm.cancel') })).toBeTruthy();
    expect(screen.getByRole('button', { name: t('taskForm.complete') })).toBeTruthy();
    expect(screen.getByRole('button', { name: t('taskForm.delete') })).toBeTruthy();
    // Not a recurring task: nothing to skip.
    expect(screen.queryByTestId('task-form.skip')).toBeNull();
  });

  it('a recurring task offers «Saltar esta vez»', () => {
    renderSheet([task('Fregar', { recurrence: { kind: 'interval', every: 1 } })]);
    expect(screen.getByRole('button', { name: t('taskForm.skip') })).toBeTruthy();
  });

  it('a done task offers «Reabrir» instead of completing it', () => {
    renderSheet([task('Fregar', { completedAt: new Date().toISOString(), completedBy: 'me' })]);
    expect(screen.getByRole('button', { name: t('taskForm.reopen') })).toBeTruthy();
    expect(screen.queryByTestId('task-form.complete')).toBeNull();
  });

  it('keeps Guardar disabled until something changes', () => {
    renderSheet([task('Fregar')]);
    expect(disabled('task-form.save')).toBe('true');
    fireEvent.change(screen.getByTestId('task-form.title'), {
      target: { value: 'Fregar los platos' },
    });
    expect(disabled('task-form.save')).not.toBe('true');
  });

  it('deletes without asking: the sheet closes and «Tarea borrada. Deshacer» shows', () => {
    renderSheet([task('Fregar')]);
    fireEvent.click(screen.getByTestId('task-form.delete'));
    // No ConfirmDialog in between.
    expect(screen.queryByTestId('discard.confirm')).toBeNull();
    expect(screen.getByText(t('tasks.deleted'))).toBeTruthy();
    expect(t('tasks.deleted')).toBe('Tarea borrada.');
    expect(screen.getByRole('button', { name: t('tasks.undo') })).toBeTruthy();
    expect(nav.router.back).toHaveBeenCalledTimes(1);
    // The server is asked only when «Deshacer» goes.
    expect(deleteTask).not.toHaveBeenCalled();
  });

  it('someone else’s task, for a member who does not run the household, has no delete', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    queryClient.setQueryData(membershipKey, { ...membership, role: 'member' });
    queryClient.setQueryData(membersKey('h'), members);
    queryClient.setQueryData(tasksKey('h'), [task('Fregar', { createdBy: 'bo' })]);
    render(
      <QueryClientProvider client={queryClient}>
        <NoticeProvider>
          <EditTaskRoute />
        </NoticeProvider>
      </QueryClientProvider>,
    );
    expect(screen.queryByTestId('task-form.delete')).toBeNull();
  });

  it('offline, deleting says it needs the connection and keeps the sheet', () => {
    onlineManager.setOnline(false);
    renderSheet([task('Fregar')]);
    fireEvent.click(screen.getByTestId('task-form.delete'));
    expect(screen.getByText(t('tasks.deleteOffline'))).toBeTruthy();
    expect(nav.router.back).not.toHaveBeenCalled();
  });

  it('while the tasks load, shows a spinner', () => {
    vi.mocked(listTasks).mockReturnValue(new Promise(() => undefined));
    renderSheet();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByTestId('task-form.title')).toBeNull();
  });

  it('when the tasks never loaded, says why and offers «Cerrar»', async () => {
    vi.mocked(listTasks).mockRejectedValue(new AppError('NETWORK'));
    onlineManager.setOnline(false);
    renderSheet();
    const error = await screen.findByTestId('task-form.not-found');
    expect(error.textContent).toBe(t('tasks.errors.NETWORK'));
    fireEvent.click(screen.getByRole('button', { name: t('taskForm.close') }));
    expect(nav.router.back).toHaveBeenCalledTimes(1);
  });

  it('a task that is no longer there says so', () => {
    nav.params = { id: 'Gone' };
    renderSheet([task('Fregar')]);
    expect(screen.getByTestId('task-form.not-found').textContent).toBe(
      t('tasks.errors.TASK_NOT_FOUND'),
    );
  });
});
