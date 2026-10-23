import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TemplatesRoute from '@/app/templates';
import { AppError } from '@/data/supabase/errors';
import { CATALOG, catalogFor, catalogLabel } from '@/domain/tasks/catalog';
import { localDateIso } from '@/domain/tasks/dates';
import type { TaskItem } from '@/domain/tasks/views';
import type { Member, Membership } from '@/features/households/api';
import { membersKey, membershipKey } from '@/features/households/keys';
import { t } from '@/i18n';
import { NoticeProvider } from '@/ui/components/Notice';
import { listTasks } from './api';
import { tasksKey } from './keys';

vi.mock('@/features/auth/SessionProvider', () => ({
  useSession: () => ({ status: 'signed-in', userId: 'me' }),
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
];
const [dishes, trash] = CATALOG.kitchen as [
  (typeof CATALOG.kitchen)[number],
  (typeof CATALOG.kitchen)[number],
];

function task(title: string): TaskItem {
  return {
    id: title,
    seriesId: `s-${title}`,
    title,
    room: 'kitchen',
    assigneeId: null,
    dueOn: today,
    completedAt: null,
    completedBy: null,
    createdBy: 'me',
    createdAt: '2026-10-01T08:00:00.000Z',
    recurrence: null,
    skippedAt: null,
    generatedFrom: null,
  };
}

/** The catalogue with the household cached; `tasks` undefined loads them. */
function renderTemplates(tasks?: TaskItem[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  queryClient.setQueryData(membershipKey, membership);
  queryClient.setQueryData(membersKey('h'), members);
  if (tasks) queryClient.setQueryData(tasksKey('h'), tasks);
  render(
    <QueryClientProvider client={queryClient}>
      <NoticeProvider>
        <TemplatesRoute />
      </NoticeProvider>
    </QueryClientProvider>,
  );
}

const add = () => screen.getByTestId('templates.add');

beforeEach(() => {
  vi.mocked(listTasks).mockReset();
  onlineManager.setOnline(true);
});

describe('Ideas de tareas', () => {
  it('lists the household’s rooms as checkboxes, and «Añadir» waits for a choice', () => {
    renderTemplates([]);
    expect(screen.getAllByText(t('templates.title')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: t('templates.cancel') })).toBeTruthy();
    expect(screen.getByTestId('templates.room.kitchen')).toBeTruthy();
    expect(screen.getByTestId('templates.room.general')).toBeTruthy();
    // Only the rooms the household has, and the whole house.
    expect(screen.queryByTestId('templates.room.bathroom')).toBeNull();
    expect(screen.getByRole('checkbox', { name: catalogLabel(dishes) })).toBeTruthy();
    expect(add().getAttribute('aria-label')).toBe(t('templates.choose'));
    expect(add().getAttribute('aria-disabled')).toBe('true');
  });

  it('choosing ideas counts them on «Añadir»', () => {
    renderTemplates([]);
    fireEvent.click(screen.getByTestId('templates.item.kitchen.dishes'));
    expect(add().getAttribute('aria-label')).toBe(t('templates.addOne'));
    expect(add().getAttribute('aria-disabled')).not.toBe('true');
    fireEvent.click(screen.getByTestId('templates.item.kitchen.trash'));
    expect(add().getAttribute('aria-label')).toBe(t('templates.addCount', { n: 2 }));
  });

  it('leaves out what the household already does', () => {
    renderTemplates([task(t(dishes.titleKey))]);
    expect(screen.queryByTestId('templates.item.kitchen.dishes')).toBeNull();
    expect(screen.getByRole('checkbox', { name: catalogLabel(trash) })).toBeTruthy();
  });

  it('with every idea already a task, says so', () => {
    const all = catalogFor(['kitchen'], new Set()).flatMap((group) =>
      group.items.map((item) => task(t(item.titleKey))),
    );
    renderTemplates(all);
    expect(screen.getByTestId('templates.empty').textContent).toBe(t('templates.empty'));
  });

  it('while the tasks load, shows the spinner and no notes', () => {
    vi.mocked(listTasks).mockReturnValue(new Promise(() => undefined));
    renderTemplates();
    expect(screen.getByTestId('templates.loading')).toBeTruthy();
    expect(screen.queryByTestId('templates.room.kitchen')).toBeNull();
    expect(screen.queryByTestId('templates.room.general')).toBeNull();
    expect(add().getAttribute('aria-disabled')).toBe('true');
  });

  it('when the tasks never loaded, says why and «Reintentar» loads them again', async () => {
    vi.mocked(listTasks).mockRejectedValue(new AppError('NETWORK'));
    onlineManager.setOnline(false);
    renderTemplates();
    const error = await screen.findByTestId('templates.load-error');
    expect(error.textContent).toBe(t('tasks.errors.NETWORK'));
    expect(screen.queryByTestId('templates.room.kitchen')).toBeNull();
    vi.mocked(listTasks).mockResolvedValue([]);
    onlineManager.setOnline(true);
    fireEvent.click(screen.getByTestId('templates.load-error.retry'));
    await vi.waitFor(() => expect(screen.getByTestId('templates.room.kitchen')).toBeTruthy());
  });

  it('offline, shows the band and keeps «Añadir» disabled even with ideas chosen', () => {
    onlineManager.setOnline(false);
    renderTemplates([]);
    expect(screen.getByTestId('templates.offline').getAttribute('aria-label')).toBe(
      t('templates.offline'),
    );
    fireEvent.click(screen.getByTestId('templates.item.kitchen.dishes'));
    expect(add().getAttribute('aria-disabled')).toBe('true');
  });

  it('online, there is no offline band', () => {
    renderTemplates([]);
    expect(screen.queryByTestId('templates.offline')).toBeNull();
  });
});
