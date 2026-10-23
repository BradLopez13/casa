import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { router } from 'expo-router';
import OnboardingScreen from '@/app/onboarding';
import { AppError } from '@/data/supabase/errors';
import { ROOMS } from '@/domain/tasks/rooms';
import { signOut } from '@/features/auth/api';
import { createHousehold, setHouseholdRooms } from '@/features/households/api';
import { t } from '@/i18n';
import { NoticeProvider } from '@/ui/components/Notice';

vi.mock('@/features/auth/SessionProvider', () => ({
  useSession: () => ({ status: 'signed-in', userId: 'me' }),
}));
vi.mock('@/features/auth/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth/api')>()),
  signOut: vi.fn(),
}));
vi.mock('@/features/households/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/households/api')>()),
  createHousehold: vi.fn(),
  setHouseholdRooms: vi.fn(),
}));

const TOKEN = 'ab'.repeat(24);

function renderOnboarding() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <NoticeProvider>
        <OnboardingScreen />
      </NoticeProvider>
    </QueryClientProvider>,
  );
}

const nameField = () => screen.getByTestId<HTMLInputElement>('onboarding.name');
const linkField = () => screen.getByTestId<HTMLInputElement>('onboarding.link');
const createButton = () => screen.getByRole('button', { name: t('onboarding.create') });
const joinButton = () => screen.getByRole('button', { name: t('onboarding.join') });
/** A button at work shows a spinner in place of its label (its name stays). */
const busy = (button: HTMLElement) => within(button).queryByRole('progressbar') !== null;

/** Past the first step: the household «Casa» was created. */
async function toRoomsStep() {
  vi.mocked(createHousehold).mockResolvedValueOnce('h');
  renderOnboarding();
  fireEvent.change(nameField(), { target: { value: 'Casa' } });
  fireEvent.click(createButton());
  await screen.findByRole('heading', { name: t('onboarding.roomsTitle') });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createHousehold).mockReset();
  vi.mocked(setHouseholdRooms).mockReset();
  vi.mocked(signOut).mockReset();
});

describe('Crear tu hogar', () => {
  it('offers the two ways in, each field and button named', () => {
    renderOnboarding();
    expect(screen.getByRole('heading', { name: t('onboarding.title') })).toBeTruthy();
    expect(nameField().getAttribute('aria-label')).toBe(t('onboarding.nameLabel'));
    expect(nameField().value).toBe(t('onboarding.defaultName'));
    expect(createButton()).toBeTruthy();
    expect(screen.getByRole('heading', { name: t('onboarding.linkTitle') })).toBeTruthy();
    expect(linkField().getAttribute('aria-label')).toBe(t('onboarding.linkLabel'));
    expect(joinButton()).toBeTruthy();
    expect(screen.getByRole('button', { name: t('account.menu') })).toBeTruthy();
  });

  it('a blank name is marked on the field and nothing is created', () => {
    renderOnboarding();
    fireEvent.change(nameField(), { target: { value: '   ' } });
    fireEvent.click(createButton());
    expect(createHousehold).not.toHaveBeenCalled();
    expect(nameField().getAttribute('aria-label')).toBe(
      `${t('onboarding.nameLabel')}, ${t('onboarding.errors.nameInvalid')}`,
    );
  });

  it('creates the household with the name written, waiting on the button', async () => {
    let finish: (id: string) => void = () => undefined;
    vi.mocked(createHousehold).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderOnboarding();
    fireEvent.change(nameField(), { target: { value: ' Casa de Ana ' } });
    fireEvent.click(createButton());
    await vi.waitFor(() => expect(busy(createButton())).toBe(true));
    expect(vi.mocked(createHousehold).mock.calls[0]?.[0]).toBe('Casa de Ana');
    finish('h');
    expect(await screen.findByRole('heading', { name: t('onboarding.roomsTitle') })).toBeTruthy();
  });

  it('without a connection, says so and keeps the name', async () => {
    vi.mocked(createHousehold).mockRejectedValueOnce(new AppError('NETWORK'));
    renderOnboarding();
    fireEvent.change(nameField(), { target: { value: 'Casa' } });
    fireEvent.click(createButton());
    expect((await screen.findByRole('alert')).textContent).toBe(t('onboarding.errors.NETWORK'));
    expect(nameField().value).toBe('Casa');
  });

  it('a link that is not an invitation is marked on its field and goes nowhere', () => {
    renderOnboarding();
    fireEvent.change(linkField(), { target: { value: 'https://example.com/hola' } });
    fireEvent.click(joinButton());
    expect(router.push).not.toHaveBeenCalled();
    expect(linkField().getAttribute('aria-label')).toBe(
      `${t('onboarding.linkLabel')}, ${t('onboarding.errors.linkInvalid')}`,
    );
  });

  it('a pasted invitation link opens the invitation with its token', () => {
    renderOnboarding();
    fireEvent.change(linkField(), { target: { value: `casa://invite?token=${TOKEN}` } });
    fireEvent.click(joinButton());
    expect(router.push).toHaveBeenCalledWith({ pathname: '/invite', params: { token: TOKEN } });
  });
});

describe('Crear tu hogar: la cuenta tras «⋯»', () => {
  it('opens a dialog with sign out and delete account', () => {
    renderOnboarding();
    expect(screen.queryByRole('button', { name: t('auth.signOut') })).toBeNull();
    fireEvent.click(screen.getByTestId('account-menu'));
    expect(screen.getByRole('heading', { name: t('account.menu') })).toBeTruthy();
    expect(screen.getByRole('button', { name: t('auth.signOut') })).toBeTruthy();
    expect(screen.getByRole('button', { name: t('settings.deleteAccount') })).toBeTruthy();
    expect(screen.getByRole('button', { name: t('account.close') })).toBeTruthy();
  });

  it('signs out from the dialog', async () => {
    vi.mocked(signOut).mockResolvedValueOnce();
    renderOnboarding();
    fireEvent.click(screen.getByTestId('account-menu'));
    fireEvent.click(screen.getByRole('button', { name: t('auth.signOut') }));
    await vi.waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });

  it('when signing out fails, says so', async () => {
    vi.mocked(signOut).mockRejectedValueOnce(new Error('offline'));
    renderOnboarding();
    fireEvent.click(screen.getByTestId('account-menu'));
    fireEvent.click(screen.getByRole('button', { name: t('auth.signOut') }));
    expect(await screen.findByText(t('auth.signOutFailed'))).toBeTruthy();
  });

  it('deleting the account asks first', () => {
    renderOnboarding();
    fireEvent.click(screen.getByTestId('account-menu'));
    fireEvent.click(screen.getByRole('button', { name: t('settings.deleteAccount') }));
    expect(screen.getByRole('heading', { name: t('settings.deleteAccountTitle') })).toBeTruthy();
    expect(screen.getByText(t('settings.deleteAccountMessage'))).toBeTruthy();
  });
});

describe('Crear tu hogar: las estancias', () => {
  // On react-native-web 0.21 `accessibilityState={{ checked }}` never becomes aria-checked, so
  // what is chosen is read from what gets saved.
  it('lists every room as a named check, all of them chosen to start with', async () => {
    vi.mocked(setHouseholdRooms).mockReturnValue(new Promise(() => undefined));
    await toRoomsStep();
    const checks = screen.getAllByRole('checkbox');
    expect(checks.map((c) => c.getAttribute('aria-label'))).toEqual(
      ROOMS.map((room) => t(`rooms.${room}`)),
    );
    fireEvent.click(screen.getByRole('button', { name: t('onboarding.roomsContinue') }));
    await vi.waitFor(() => expect(setHouseholdRooms).toHaveBeenCalled());
    expect(vi.mocked(setHouseholdRooms).mock.calls[0]?.[0]).toEqual([...ROOMS]);
  });

  it('saves only the rooms left chosen', async () => {
    vi.mocked(setHouseholdRooms).mockReturnValue(new Promise(() => undefined));
    await toRoomsStep();
    fireEvent.click(screen.getByRole('checkbox', { name: t('rooms.laundry') }));
    const proceed = screen.getByRole('button', { name: t('onboarding.roomsContinue') });
    fireEvent.click(proceed);
    await vi.waitFor(() => expect(setHouseholdRooms).toHaveBeenCalled());
    expect(vi.mocked(setHouseholdRooms).mock.calls[0]?.[0]).toEqual(
      ROOMS.filter((room) => room !== 'laundry'),
    );
    expect(busy(proceed)).toBe(true);
  });

  it('with no room chosen, Continuar does nothing', async () => {
    await toRoomsStep();
    for (const room of ROOMS)
      fireEvent.click(screen.getByRole('checkbox', { name: t(`rooms.${room}`) }));
    fireEvent.click(screen.getByRole('button', { name: t('onboarding.roomsContinue') }));
    expect(setHouseholdRooms).not.toHaveBeenCalled();
  });

  it('when saving fails, says so and lets them try again', async () => {
    vi.mocked(setHouseholdRooms).mockRejectedValueOnce(new AppError('NETWORK'));
    await toRoomsStep();
    const proceed = screen.getByRole('button', { name: t('onboarding.roomsContinue') });
    fireEvent.click(proceed);
    expect((await screen.findByRole('alert')).textContent).toBe(t('onboarding.errors.NETWORK'));
    expect(busy(proceed)).toBe(false);
  });
});
