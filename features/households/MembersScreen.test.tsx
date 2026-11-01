import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MembersScreen from '@/app/household/members';
import { AppError } from '@/data/supabase/errors';
import { t } from '@/i18n';
import { NoticeProvider } from '@/ui/components/Notice';
import {
  listActiveInvites,
  listMembers,
  type ActiveInvite,
  type Member,
  type Membership,
} from './api';
import { householdsKey, invitesKey, membersKey, membershipKey } from './keys';

vi.mock('@/features/auth/SessionProvider', () => ({
  useSession: () => ({ status: 'signed-in', userId: 'me' }),
}));
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  listMembers: vi.fn(),
  listActiveInvites: vi.fn(),
}));

const owner: Membership = {
  householdId: 'h',
  householdName: 'Casa',
  role: 'owner',
  rooms: ['kitchen'],
};
const members: Member[] = [
  { userId: 'me', displayName: 'Ana', role: 'owner', joinedAt: '2026-10-01' },
  { userId: 'bo', displayName: 'Bo', role: 'member', joinedAt: '2026-10-02' },
];
const invite: ActiveInvite = {
  id: 'i1',
  expiresAt: '2026-10-30T08:00:00.000Z',
  createdBy: 'me',
};

/** Miembros with the membership cached; `cached` members and invites, or loaded. */
function renderMembers({
  membership = owner,
  cached = members,
  invites = [],
  households,
}: {
  membership?: Membership;
  cached?: Member[] | null;
  invites?: ActiveInvite[] | null;
  households?: Membership[];
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  queryClient.setQueryData(membershipKey, membership);
  if (cached) queryClient.setQueryData(membersKey('h'), cached);
  if (invites) queryClient.setQueryData(invitesKey('h'), invites);
  if (households) queryClient.setQueryData(householdsKey, households);
  render(
    <QueryClientProvider client={queryClient}>
      <NoticeProvider>
        <MembersScreen />
      </NoticeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(listMembers).mockReset();
  vi.mocked(listActiveInvites).mockReset().mockResolvedValue([]);
  onlineManager.setOnline(true);
});

describe('Miembros', () => {
  it('names its controls: Volver, Invitar, Copiar enlace, Salir del hogar and Borrar hogar', () => {
    renderMembers();
    expect(screen.getAllByText(t('members.title')).length).toBeGreaterThan(0);
    for (const name of [
      t('members.back'),
      t('members.invite'),
      t('members.copyLink'),
      t('members.leave'),
      t('members.deleteHousehold'),
    ])
      expect(screen.getByRole('button', { name })).toBeTruthy();
  });

  it('with no invites, says so in one sentence and has no «Invitaciones pendientes» title', () => {
    renderMembers({ invites: [] });
    expect(screen.queryByText(t('members.pendingTitle'))).toBeNull();
    expect(screen.getByText(t('members.pendingEmpty'))).toBeTruthy();
    expect(t('members.pendingEmpty')).toBe('Nadie invitado ahora mismo.');
  });

  it('with an invite, shows it under its title, with its link and its revoke', () => {
    renderMembers({ invites: [invite] });
    expect(screen.getByRole('heading', { name: t('members.pendingTitle') })).toBeTruthy();
    expect(screen.queryByText(t('members.pendingEmpty'))).toBeNull();
    expect(screen.getByTestId('members.invite-row.i1')).toBeTruthy();
    expect(screen.getByRole('button', { name: t('members.revoke') })).toBeTruthy();
    // The link is copied from the invite's card, not twice.
    expect(screen.getAllByTestId('members.copy-link')).toHaveLength(1);
  });

  it('who runs the household has «⋯» on everyone else, and not on their own note', () => {
    renderMembers();
    const more = screen.getByTestId('members.menu.bo');
    expect(more.getAttribute('aria-label')).toBe(t('members.more', { name: 'Bo' }));
    expect(screen.queryByTestId('members.menu.me')).toBeNull();
  });

  it('a member who does not run the household has no «⋯» and no «Borrar hogar»', () => {
    renderMembers({ membership: { ...owner, role: 'member' } });
    expect(screen.queryByTestId('members.menu.bo')).toBeNull();
    expect(screen.queryByTestId('members.menu.me')).toBeNull();
    expect(screen.queryByTestId('members.delete-household')).toBeNull();
    expect(screen.getByRole('button', { name: t('members.leave') })).toBeTruthy();
  });

  it('«Borrar casa» asks before doing anything', () => {
    renderMembers();
    fireEvent.click(screen.getByTestId('members.delete-household'));
    expect(screen.getByTestId('members.confirm')).toBeTruthy();
    expect(screen.getByTestId('members.cancel')).toBeTruthy();
  });

  // Bloque 13 (P3-10): with more than one house, the irreversible says which.
  it('with two houses, «Borrar casa» names the one it deletes', () => {
    const other: Membership = { ...owner, householdId: 'mama', householdName: 'Casa de mamá' };
    renderMembers({ households: [owner, other] });
    fireEvent.click(screen.getByTestId('members.delete-household'));
    expect(
      screen.getByText(t('members.confirm.deleteTitleNamed', { household: owner.householdName })),
    ).toBeTruthy();
  });

  it('the owner of a household with others cannot leave: it says to hand it over first', () => {
    renderMembers();
    fireEvent.click(screen.getByTestId('members.leave'));
    expect(screen.getByTestId('members.footer-error').textContent).toBe(
      t('members.errors.OWNER_MUST_TRANSFER'),
    );
  });

  it('while the people load, says so', () => {
    vi.mocked(listMembers).mockReturnValue(new Promise(() => undefined));
    renderMembers({ cached: null });
    expect(screen.getAllByText(t('members.loading')).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('members.row.me')).toBeNull();
  });

  it('when the people never loaded, says why and «Reintentar» loads them again', async () => {
    vi.mocked(listMembers).mockRejectedValueOnce(new AppError('NETWORK'));
    renderMembers({ cached: null });
    const error = await screen.findByTestId('members.load-error');
    expect(error.textContent).toBe(t('members.loadError'));
    vi.mocked(listMembers).mockResolvedValueOnce(members);
    fireEvent.click(screen.getByTestId('members.load-error.retry'));
    await vi.waitFor(() => expect(screen.getByTestId('members.row.bo')).toBeTruthy());
    expect(listMembers).toHaveBeenCalledTimes(2);
  });

  it('when the invites never loaded, says so with its own «Reintentar»', async () => {
    vi.mocked(listActiveInvites).mockRejectedValueOnce(new AppError('NETWORK'));
    renderMembers({ invites: null });
    const error = await screen.findByTestId('members.invites-error');
    expect(error.textContent).toBe(t('members.invitesLoadError'));
    expect(screen.getByTestId('members.invites-error.retry')).toBeTruthy();
  });

  it('offline, says inviting and changing the household need the connection', () => {
    onlineManager.setOnline(false);
    renderMembers();
    expect(screen.getByTestId('members.offline').getAttribute('aria-label')).toBe(
      t('members.offline'),
    );
  });

  it('online, there is no offline band', () => {
    renderMembers();
    expect(screen.queryByTestId('members.offline')).toBeNull();
  });
});
