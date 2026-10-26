import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NewTaskRoute from '@/app/task/new';
import { addDays, localDateIso } from '@/domain/tasks/dates';
import type { Member, Membership } from '@/features/households/api';
import { membersKey, membershipKey } from '@/features/households/keys';
import { t } from '@/i18n';
import { NoticeProvider } from '@/ui/components/Notice';
import { createTask } from './api';
import { tasksKey } from './keys';

// The form reads who and when from the route, and closes through `navigation.isFocused()`.
const nav = vi.hoisted(() => {
  const params: Record<string, string> = {};
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
  useSession: () => ({
    status: 'signed-in',
    userId: '00000000-0000-4000-8000-000000000001',
  }),
}));
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  createTask: vi.fn(),
}));

// The form's schema takes real ids (uuids) for the people.
const ME = '00000000-0000-4000-8000-000000000001';
const BO = '00000000-0000-4000-8000-000000000002';
const today = localDateIso(new Date());
const membership: Membership = {
  householdId: 'h',
  householdName: 'Casa',
  role: 'owner',
  rooms: ['kitchen'],
};
const members: Member[] = [
  { userId: ME, displayName: 'Ana', role: 'owner', joinedAt: '2026-10-01' },
  { userId: BO, displayName: 'Bo', role: 'member', joinedAt: '2026-10-02' },
];

function renderNew() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  queryClient.setQueryData(membershipKey, membership);
  queryClient.setQueryData(membersKey('h'), members);
  queryClient.setQueryData(tasksKey('h'), []);
  render(
    <QueryClientProvider client={queryClient}>
      <NoticeProvider>
        <NewTaskRoute />
      </NoticeProvider>
    </QueryClientProvider>,
  );
  return queryClient;
}

const titleField = () => screen.getByTestId<HTMLInputElement>('task-form.title');

beforeEach(() => {
  vi.mocked(createTask)
    .mockReset()
    .mockResolvedValue(undefined as never);
  nav.router.back.mockClear();
  nav.params = {};
  onlineManager.setOnline(true);
});

describe('Nueva tarea', () => {
  it('opens empty, with Guardar and Cancelar named and Guardar waiting for a title', () => {
    renderNew();
    expect(screen.getAllByText(t('taskForm.newTitle')).length).toBeGreaterThan(0);
    expect(titleField().value).toBe('');
    expect(titleField().getAttribute('placeholder')).toBe(t('taskForm.titlePlaceholder'));
    // A pósit that does nothing contradicts «pósit es hacer» (bloque 11): it waits, saying why.
    const save = screen.getByTestId('task-form.save');
    expect(save.getAttribute('aria-disabled')).toBe('true');
    expect(save.getAttribute('aria-label')).toBe(
      `${t('taskForm.save')}. ${t('taskForm.titleRequired')}`,
    );
    expect(screen.getByRole('button', { name: t('taskForm.cancel') })).toBeTruthy();
    // A new task has nothing to complete, skip or delete.
    expect(screen.queryByTestId('task-form.delete')).toBeNull();
    expect(screen.queryByTestId('task-form.complete')).toBeNull();
  });

  it('without a title, does not save', () => {
    renderNew();
    fireEvent.click(screen.getByTestId('task-form.save'));
    expect(createTask).not.toHaveBeenCalled();
  });

  it('saves into the household and closes', async () => {
    renderNew();
    fireEvent.change(titleField(), { target: { value: 'Regar' } });
    fireEvent.click(screen.getByTestId('task-form.save'));
    await vi.waitFor(() => expect(createTask).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createTask).mock.calls[0]?.[1]).toBe('h');
    expect(vi.mocked(createTask).mock.calls[0]?.[2]).toMatchObject({ title: 'Regar' });
    await vi.waitFor(() => expect(nav.router.back).toHaveBeenCalledTimes(1));
  });

  // Bloque 11: the «+» of Tareas' «Todas» opens it without a date.
  it('opened for no day starts the task without a date', () => {
    nav.params = { due: 'none' };
    renderNew();
    expect(screen.getByTestId('task-form.prop.due').textContent).toContain(t('tasks.due.none'));
    nav.params = {};
  });

  // Bloque 11 (T6): the form now has a way in, so it queues like the quick add: offline it closes
  // at once with the note on the list, and the create waits for the connection.
  it('offline, saves into the queue and closes at once', async () => {
    onlineManager.setOnline(false);
    const queryClient = renderNew();
    fireEvent.change(titleField(), { target: { value: 'Regar' } });
    fireEvent.click(screen.getByTestId('task-form.save'));
    await vi.waitFor(() => expect(nav.router.back).toHaveBeenCalledTimes(1));
    expect(createTask).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(
        queryClient.getQueryData<{ title: string }[]>(tasksKey('h'))?.map((task) => task.title),
      ).toEqual(['Regar']),
    );
    onlineManager.setOnline(true);
    await vi.waitFor(() => expect(createTask).toHaveBeenCalledTimes(1));
  });

  it('a link that names someone and a day starts the task for them that day', async () => {
    nav.params = { assignee: BO, due: addDays(today, 2) };
    renderNew();
    fireEvent.change(titleField(), { target: { value: 'Regar' } });
    fireEvent.click(screen.getByTestId('task-form.save'));
    await vi.waitFor(() => expect(createTask).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createTask).mock.calls[0]?.[2]).toMatchObject({
      assigneeId: BO,
      dueOn: addDays(today, 2),
    });
  });
});
