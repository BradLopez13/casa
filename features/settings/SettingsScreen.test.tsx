import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsScreen from '@/app/(tabs)/settings';
import { AppError } from '@/data/supabase/errors';
import { listMembers, type Member, type Membership } from '@/features/households/api';
import { householdsKey, membersKey, membershipKey } from '@/features/households/keys';
import { t } from '@/i18n';
import { NoticeProvider } from '@/ui/components/Notice';

vi.mock('@/features/auth/SessionProvider', () => ({
  useSession: () => ({ status: 'signed-in', userId: 'me' }),
}));
vi.mock('@/features/households/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/households/api')>()),
  listMembers: vi.fn(),
}));
// The notes that talk to the phone's notifications are tested apart.
vi.mock('@/features/push/HouseholdNoticesSection', () => ({ HouseholdNoticesSection: () => null }));
vi.mock('@/features/reminders/ReminderSettingsSection', () => ({
  ReminderSettingsSection: () => null,
}));
vi.mock('@/features/settings/useNotificationPermission', () => ({
  useNotificationPermission: () => 'granted',
}));

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

/** Ajustes with the membership cached; `cached` members, or loaded through `listMembers`. */
function renderSettings(cached?: Member[], queued = 0, households: Membership[] = [membership]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  // Changes waiting for the connection, as the shopping queue leaves them.
  if (queued > 0) onlineManager.setOnline(false);
  for (let i = 0; i < queued; i += 1) {
    void queryClient
      .getMutationCache()
      .build(queryClient, {
        mutationKey: ['shopping', 'add'],
        networkMode: 'online',
        mutationFn: () => Promise.resolve(),
      })
      .execute({ id: `q${i}` })
      .catch(() => undefined);
  }
  queryClient.setQueryData(membershipKey, membership);
  queryClient.setQueryData(householdsKey, households);
  if (cached) queryClient.setQueryData(membersKey('h'), cached);
  render(
    <QueryClientProvider client={queryClient}>
      <NoticeProvider>
        <SettingsScreen />
      </NoticeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(listMembers).mockReset();
  onlineManager.setOnline(true);
});

describe('Ajustes', () => {
  // Bloque 11 (T2): signing out wipes the queue from the phone, so it says so first.
  it('signing out with changes not sent yet says they would be lost, and offers to wait', async () => {
    renderSettings(members, 2);
    fireEvent.click(screen.getByTestId('settings.sign-out'));
    expect(await screen.findByText(t('auth.signOutUnsent', { count: 2 }))).toBeTruthy();
    expect(screen.getByTestId('members.confirm').getAttribute('aria-label')).toBe(
      t('auth.signOutAnyway'),
    );
    expect(screen.getByTestId('members.cancel').getAttribute('aria-label')).toBe(
      t('auth.signOutWait'),
    );
  });

  it('signing out with nothing waiting asks as always', () => {
    renderSettings(members);
    fireEvent.click(screen.getByTestId('settings.sign-out'));
    expect(screen.getByText(t('auth.signOutMessage'))).toBeTruthy();
  });

  it('with the household loaded, Borrar mi cuenta is there with no excuse and no band', () => {
    renderSettings(members);
    expect(screen.queryByTestId('settings.members-error')).toBeNull();
    expect(screen.queryByTestId('settings.delete-account.waiting')).toBeNull();
    expect(screen.queryByTestId('settings.offline')).toBeNull();
  });

  // Fase 10f: no white cards with switches; each note is held by the magnet of what it holds.
  it('holds every note with the magnet of what it holds, and your account with yours', () => {
    renderSettings(members);
    for (const glyph of ['account-group-outline', 'alarm', 'home-outline', 'help-circle-outline']) {
      expect(document.querySelector(`[data-icon="${glyph}"]`)).not.toBeNull();
    }
    expect(screen.getByTestId('settings.account').textContent).toContain('A');
    // The magnet already says what the row is: the row keeps only its chevron.
    expect(screen.getByTestId('settings.members').querySelectorAll('[data-icon]').length).toBe(1);
  });

  it('when the members fail, says what happened and what to do, and retries', async () => {
    vi.mocked(listMembers).mockRejectedValueOnce(new AppError('NETWORK'));
    renderSettings();
    const message = await screen.findByTestId('settings.members-error');
    expect(message.textContent).toBe(t('members.loadError'));
    // No pencil over an empty name.
    expect(screen.queryByRole('button', { name: t('settings.editName') })).toBeNull();
    // The error already says what is missing: no second line under Borrar.
    expect(screen.queryByTestId('settings.delete-account.waiting')).toBeNull();
    vi.mocked(listMembers).mockResolvedValueOnce(members);
    fireEvent.click(screen.getByTestId('settings.members-error.retry'));
    await vi.waitFor(() => expect(screen.queryByTestId('settings.members-error')).toBeNull());
    expect(listMembers).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('settings.delete-account.waiting')).toBeNull();
  });

  it('while the members load, Borrar mi cuenta says why it waits', () => {
    vi.mocked(listMembers).mockReturnValue(new Promise(() => undefined));
    renderSettings();
    expect(screen.getByTestId('settings.delete-account.waiting').textContent).toBe(
      t('settings.deleteAccountWaiting'),
    );
  });

  it('without a connection, says saving needs it', () => {
    onlineManager.setOnline(false);
    renderSettings(members);
    expect(screen.getByTestId('settings.offline').getAttribute('aria-label')).toBe(
      t('settings.offline'),
    );
  });

  // Bloque 12: one person, several households. Bloque 13 (decisión 5, A): with one, «Tu casa»
  // goes under Miembros and Invitar, and nothing in it is a button that does nothing.
  it('with one household, «Tu casa» holds it, its licence and the two ways to another', () => {
    renderSettings(members);
    expect(screen.getByTestId('settings.household-name').textContent).toBe('Casa, con Bo');
    expect(screen.getByRole('heading', { name: t('households.titleOne') })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Casa, ' + t('households.here') })).toBeNull();
    expect(screen.getByText(t('households.here'))).toBeTruthy();
    expect(screen.getByRole('button', { name: t('households.license') })).toBeTruthy();
    expect(screen.getByRole('button', { name: t('households.create') })).toBeTruthy();
    expect(screen.getByRole('button', { name: t('households.join') })).toBeTruthy();
  });

  it('with one household, Miembros and Invitar come before «Tu casa»', () => {
    renderSettings(members);
    const order = screen
      .getAllByRole('button')
      .map((b) => b.getAttribute('data-testid'))
      .filter((id) => id === 'settings.members' || id === 'settings.license');
    expect(order).toEqual(['settings.members', 'settings.license']);
  });

  it('without a connection, Invitar and «Crear otra casa» say they wait for it', () => {
    onlineManager.setOnline(false);
    renderSettings(members);
    expect(screen.getByTestId('settings.invite').getAttribute('aria-label')).toBe(
      `${t('settings.invite')}. ${t('settings.inviteNeedsNet')}`,
    );
    expect(screen.getByTestId('settings.household-create').getAttribute('aria-label')).toBe(
      `${t('households.create')}. ${t('households.createNeedsNet')}`,
    );
  });

  it('with two, the door says so and the other household is a tap away', async () => {
    const mama: Membership = { ...membership, householdId: 'mama', householdName: 'Casa de mamá' };
    renderSettings(members, 0, [membership, mama]);
    expect(screen.getByTestId('settings.household-name').textContent).toBe(
      'Casa, con Bo · y 1 casa más',
    );
    const other = screen.getByRole('button', {
      name: t('households.switchTo', { household: 'Casa de mamá' }),
    });
    expect(screen.getByRole('heading', { name: t('households.title') })).toBeTruthy();
    fireEvent.click(other);
    await vi.waitFor(() =>
      expect(screen.getByTestId('settings.household-name').textContent).toContain('Casa de mamá'),
    );
  });
});
