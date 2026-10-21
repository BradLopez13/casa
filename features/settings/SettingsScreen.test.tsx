import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsScreen from '@/app/(tabs)/settings';
import { AppError } from '@/data/supabase/errors';
import { listMembers, type Member, type Membership } from '@/features/households/api';
import { membersKey, membershipKey } from '@/features/households/keys';
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
function renderSettings(cached?: Member[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  queryClient.setQueryData(membershipKey, membership);
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
  it('with the household loaded, Borrar mi cuenta is there with no excuse and no band', () => {
    renderSettings(members);
    expect(screen.queryByTestId('settings.members-error')).toBeNull();
    expect(screen.queryByTestId('settings.delete-account.waiting')).toBeNull();
    expect(screen.queryByTestId('settings.offline')).toBeNull();
  });

  it('when the members fail, says what happened and what to do, and retries', async () => {
    vi.mocked(listMembers).mockRejectedValueOnce(new AppError('NETWORK'));
    renderSettings();
    const message = await screen.findByTestId('settings.members-error');
    expect(message.textContent).toBe(t('members.loadError'));
    expect(screen.getByTestId('settings.delete-account.waiting').textContent).toBe(
      t('settings.deleteAccountWaiting'),
    );
    vi.mocked(listMembers).mockResolvedValueOnce(members);
    fireEvent.click(screen.getByTestId('settings.members-error.retry'));
    await vi.waitFor(() => expect(screen.queryByTestId('settings.members-error')).toBeNull());
    expect(listMembers).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('settings.delete-account.waiting')).toBeNull();
  });

  it('without a connection, says changes wait for it', () => {
    onlineManager.setOnline(false);
    renderSettings(members);
    expect(screen.getByTestId('settings.offline').getAttribute('aria-label')).toBe(
      t('settings.offline'),
    );
  });
});
