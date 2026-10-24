import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InviteScreen from '@/app/invite';
import { AppError } from '@/data/supabase/errors';
import { signOut } from '@/features/auth/api';
import {
  acceptInvite,
  getMyMembership,
  previewInvite,
  type Membership,
} from '@/features/households/api';
import { pendingInviteKey } from '@/features/households/pending-invite';
import { t } from '@/i18n';
import { NoticeProvider } from '@/ui/components/Notice';

// The invitation arrives as `?token=`, and the screen differs signed in and signed out: both
// are the test's to set.
const nav = vi.hoisted(() => ({
  params: {},
  status: 'signed-in',
  router: { push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: vi.fn(() => true) },
}));
vi.mock('expo-router', () => ({
  useRouter: () => nav.router,
  router: nav.router,
  useLocalSearchParams: () => nav.params,
  useSegments: () => [],
  useIsFocused: () => true,
  useFocusEffect: () => undefined,
  useNavigation: () => ({ addListener: () => () => undefined, dispatch: vi.fn() }),
}));
vi.mock('@/features/auth/SessionProvider', () => ({
  useSession: () => ({ status: nav.status, userId: nav.status === 'signed-in' ? 'me' : null }),
}));
vi.mock('@/features/auth/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth/api')>()),
  signOut: vi.fn(),
}));
vi.mock('@/features/households/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/households/api')>()),
  previewInvite: vi.fn(),
  acceptInvite: vi.fn(),
  getMyMembership: vi.fn(),
}));

const TOKEN = 'ab'.repeat(24);
const preview = { householdName: 'Casa', inviterName: 'Ana', memberCount: 2 };
const membership: Membership = {
  householdId: 'h',
  householdName: 'Casa',
  role: 'member',
  rooms: ['kitchen'],
};

function renderInvite() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  // No invitation kept on this phone from before.
  queryClient.setQueryData(pendingInviteKey, null);
  render(
    <QueryClientProvider client={queryClient}>
      <NoticeProvider>
        <InviteScreen />
      </NoticeProvider>
    </QueryClientProvider>,
  );
}

const acceptButton = () => screen.getByRole('button', { name: t('invite.accept') });
/** A button at work shows a spinner in place of its label (its name stays). */
const busy = (button: HTMLElement) => within(button).queryByRole('progressbar') !== null;

beforeEach(() => {
  vi.clearAllMocks();
  for (const fn of [previewInvite, acceptInvite, getMyMembership, signOut])
    vi.mocked(fn).mockReset();
  vi.mocked(previewInvite).mockResolvedValue(preview);
  nav.params = { token: TOKEN };
  nav.status = 'signed-in';
  window.localStorage.clear();
});

describe('Invitación', () => {
  it('says which household, who invites and how many live there, with both answers named', async () => {
    renderInvite();
    expect(
      await screen.findByRole('heading', { name: t('invite.titleNamed', { household: 'Casa' }) }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        t('invite.from', { name: 'Ana', members: t('invite.membersOther', { count: 2 }) }),
      ),
    ).toBeTruthy();
    expect(screen.getByText(t('invite.body'))).toBeTruthy();
    expect(acceptButton()).toBeTruthy();
    expect(screen.getByRole('button', { name: t('invite.dismiss') })).toBeTruthy();
    expect(screen.getByRole('button', { name: t('account.menu') })).toBeTruthy();
    expect(previewInvite).toHaveBeenCalledWith(TOKEN);
  });

  it('while the preview loads, shows nothing rather than a title that changes', () => {
    vi.mocked(previewInvite).mockReturnValue(new Promise(() => undefined));
    renderInvite();
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByRole('button', { name: t('invite.accept') })).toBeNull();
  });

  it('accepts the invitation of the link, then lets the guard take them home', async () => {
    let finish: (id: string) => void = () => undefined;
    vi.mocked(acceptInvite).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    vi.mocked(getMyMembership).mockResolvedValue(membership);
    renderInvite();
    fireEvent.click(await screen.findByRole('button', { name: t('invite.accept') }));
    expect(acceptInvite).toHaveBeenCalledWith(TOKEN);
    await vi.waitFor(() => expect(busy(acceptButton())).toBe(true));
    finish('h');
    await vi.waitFor(() => expect(nav.router.replace).toHaveBeenCalledWith('/'));
    expect(getMyMembership).toHaveBeenCalled();
  });

  it('without a connection, says so and leaves the invitation to accept again', async () => {
    vi.mocked(acceptInvite).mockRejectedValueOnce(new AppError('NETWORK'));
    renderInvite();
    fireEvent.click(await screen.findByRole('button', { name: t('invite.accept') }));
    expect((await screen.findByRole('alert')).textContent).toBe(t('invite.errors.NETWORK'));
    expect(busy(acceptButton())).toBe(false);
    vi.mocked(acceptInvite).mockResolvedValueOnce('h');
    vi.mocked(getMyMembership).mockResolvedValue(membership);
    fireEvent.click(acceptButton());
    await vi.waitFor(() => expect(nav.router.replace).toHaveBeenCalledWith('/'));
    expect(acceptInvite).toHaveBeenCalledTimes(2);
  });

  it('joined but the household did not load: Reintentar loads it again without accepting twice', async () => {
    vi.mocked(acceptInvite).mockResolvedValueOnce('h');
    vi.mocked(getMyMembership).mockRejectedValueOnce(new AppError('UNKNOWN'));
    renderInvite();
    fireEvent.click(await screen.findByRole('button', { name: t('invite.accept') }));
    expect((await screen.findByRole('alert')).textContent).toBe(t('errors.membershipLoad'));
    vi.mocked(getMyMembership).mockResolvedValueOnce(membership);
    fireEvent.click(screen.getByRole('button', { name: t('errors.retry') }));
    await vi.waitFor(() => expect(nav.router.replace).toHaveBeenCalledWith('/'));
    expect(acceptInvite).toHaveBeenCalledTimes(1);
    expect(getMyMembership).toHaveBeenCalledTimes(2);
  });

  it('an expired invitation says so with the plain title, and Continuar goes on', async () => {
    vi.mocked(previewInvite).mockRejectedValue(new AppError('INVITE_EXPIRED'));
    vi.mocked(getMyMembership).mockResolvedValue(null);
    renderInvite();
    expect((await screen.findByRole('alert')).textContent).toBe(t('invite.errors.INVITE_EXPIRED'));
    expect(screen.getByRole('heading', { name: t('invite.title') })).toBeTruthy();
    expect(screen.queryByRole('button', { name: t('invite.accept') })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: t('invite.continue') }));
    await vi.waitFor(() => expect(nav.router.replace).toHaveBeenCalledWith('/'));
  });

  it('already in a household: says the invitation was not used', async () => {
    vi.mocked(acceptInvite).mockRejectedValueOnce(new AppError('ALREADY_IN_HOUSEHOLD'));
    vi.mocked(getMyMembership).mockResolvedValue(membership);
    renderInvite();
    fireEvent.click(await screen.findByRole('button', { name: t('invite.accept') }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      t('invite.errors.ALREADY_IN_HOUSEHOLD'),
    );
    expect(screen.getByRole('button', { name: t('invite.continue') })).toBeTruthy();
    expect(nav.router.replace).not.toHaveBeenCalled();
  });

  it('with no invitation at all, says it is not valid and offers the way back', async () => {
    nav.params = {};
    renderInvite();
    expect((await screen.findByRole('alert')).textContent).toBe(t('invite.errors.INVITE_INVALID'));
    expect(previewInvite).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: t('invite.back') }));
    expect(nav.router.replace).toHaveBeenCalledWith('/');
  });

  it('«No, gracias» lets the invitation go', async () => {
    renderInvite();
    fireEvent.click(await screen.findByRole('button', { name: t('invite.dismiss') }));
    await vi.waitFor(() => expect(nav.router.replace).toHaveBeenCalledWith('/'));
    expect(acceptInvite).not.toHaveBeenCalled();
  });
});

describe('Invitación sin sesión', () => {
  it('keeps the invitation on the phone and goes to sign in', async () => {
    nav.status = 'signed-out';
    renderInvite();
    await vi.waitFor(() => expect(nav.router.replace).toHaveBeenCalledWith('/sign-in'));
    expect(window.localStorage.getItem('pendingInviteToken')).toBe(TOKEN);
    expect(previewInvite).not.toHaveBeenCalled();
  });

  it('a malformed link says it is not valid, keeps nothing and offers the way back', () => {
    nav.status = 'signed-out';
    nav.params = { token: 'no-es-un-token' };
    renderInvite();
    expect(screen.getByRole('alert').textContent).toBe(t('invite.errors.INVITE_INVALID'));
    expect(window.localStorage.getItem('pendingInviteToken')).toBeNull();
    expect(nav.router.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: t('invite.back') }));
    expect(nav.router.replace).toHaveBeenCalledWith('/sign-in');
  });
});

describe('Invitación: la cuenta tras «⋯»', () => {
  it('opens a dialog with sign out and delete account', async () => {
    renderInvite();
    fireEvent.click(await screen.findByTestId('account-menu'));
    expect(screen.getByRole('heading', { name: t('account.menu') })).toBeTruthy();
    expect(screen.getByRole('button', { name: t('auth.signOut') })).toBeTruthy();
    expect(screen.getByRole('button', { name: t('settings.deleteAccount') })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('settings.deleteAccount') }));
    expect(screen.getByRole('heading', { name: t('settings.deleteAccountTitle') })).toBeTruthy();
  });

  it('signing out forgets the invitation kept for this account first', async () => {
    window.localStorage.setItem('pendingInviteToken', TOKEN);
    vi.mocked(signOut).mockResolvedValueOnce();
    renderInvite();
    fireEvent.click(await screen.findByTestId('account-menu'));
    fireEvent.click(screen.getByRole('button', { name: t('auth.signOut') }));
    await vi.waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(window.localStorage.getItem('pendingInviteToken')).toBeNull();
  });
});
