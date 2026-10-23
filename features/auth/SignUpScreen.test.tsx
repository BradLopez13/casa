import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SignUpScreen from '@/app/(auth)/sign-up';
import { AuthFailure, signUp } from '@/features/auth/api';
import { pendingInviteKey } from '@/features/households/pending-invite';
import { t } from '@/i18n';

// «Cambiar correo» comes back here with the email and name: the params are the test's to set.
const nav = vi.hoisted(() => ({
  params: {},
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
vi.mock('@/features/auth/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth/api')>()),
  signUp: vi.fn(),
}));
// Google and Apple are tested apart; here they are switched off.
vi.mock('@/features/auth/social/SocialButtons', () => ({ SocialButtons: () => null }));

function renderSignUp({ pendingInvite = null }: { pendingInvite?: string | null } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  queryClient.setQueryData(pendingInviteKey, pendingInvite);
  render(
    <QueryClientProvider client={queryClient}>
      <SignUpScreen />
    </QueryClientProvider>,
  );
}

const field = (id: 'name' | 'email' | 'password' | 'password-confirm') =>
  screen.getByTestId<HTMLInputElement>(`sign-up.${id}`);
const submit = () => screen.getByRole('button', { name: t('auth.signUp.submit') });
/** A button at work shows a spinner in place of its label (its name stays). */
const busy = (button: HTMLElement) => within(button).queryByRole('progressbar') !== null;
const type = (id: Parameters<typeof field>[0], value: string) =>
  fireEvent.change(field(id), { target: { value } });

function fillAll(password = 'secreta12', confirm = password) {
  type('name', 'Ana');
  type('email', ' ana@example.com ');
  type('password', password);
  type('password-confirm', confirm);
}

beforeEach(() => {
  vi.mocked(signUp).mockReset();
  nav.params = {};
  vi.clearAllMocks();
});

describe('Crear cuenta', () => {
  it('names each field and button for a screen reader, and says the password rule', () => {
    renderSignUp();
    expect(screen.getByRole('heading', { name: t('auth.signUp.title') })).toBeTruthy();
    expect(field('name').getAttribute('aria-label')).toBe(t('auth.fields.displayName'));
    expect(field('email').getAttribute('aria-label')).toBe(t('auth.fields.email'));
    expect(field('password').getAttribute('aria-label')).toBe(t('auth.fields.password'));
    expect(field('password-confirm').getAttribute('aria-label')).toBe(
      t('auth.fields.passwordConfirm'),
    );
    expect(screen.getByText(t('auth.hints.passwordRule'))).toBeTruthy();
    expect(submit()).toBeTruthy();
    expect(screen.getByRole('button', { name: t('auth.signUp.goSignIn') })).toBeTruthy();
    // One eye per password field.
    expect(screen.getAllByRole('button', { name: t('auth.password.show') })).toHaveLength(2);
  });

  it('each eye shows and hides its own password', () => {
    renderSignUp();
    fireEvent.click(screen.getByTestId('sign-up.password.toggle'));
    expect(field('password').type).toBe('text');
    expect(field('password-confirm').type).toBe('password');
    expect(screen.getByTestId('sign-up.password.toggle').getAttribute('aria-label')).toBe(
      t('auth.password.hide'),
    );
    fireEvent.click(screen.getByTestId('sign-up.password.toggle'));
    expect(field('password').type).toBe('password');
  });

  it('starts from the name and email it was sent back with', () => {
    nav.params = { email: 'ana@example.com', name: 'Ana' };
    renderSignUp();
    expect(field('name').value).toBe('Ana');
    expect(field('email').value).toBe('ana@example.com');
  });

  it('with nothing written, marks each field with what it needs and does not call the server', () => {
    renderSignUp();
    fireEvent.click(submit());
    expect(signUp).not.toHaveBeenCalled();
    expect(field('name').getAttribute('aria-label')).toBe(
      `${t('auth.fields.displayName')}, ${t('auth.errors.nameRequired')}`,
    );
    expect(field('email').getAttribute('aria-label')).toBe(
      `${t('auth.fields.email')}, ${t('auth.errors.emailInvalid')}`,
    );
    expect(field('password').getAttribute('aria-label')).toBe(
      `${t('auth.fields.password')}, ${t('auth.errors.passwordTooShort')}`,
    );
    expect(field('password-confirm').getAttribute('aria-label')).toBe(
      `${t('auth.fields.passwordConfirm')}, ${t('auth.errors.passwordConfirmRequired')}`,
    );
  });

  it('when the two passwords differ, says so on the second and does not call the server', () => {
    renderSignUp();
    fillAll('secreta12', 'secreta13');
    fireEvent.click(submit());
    expect(signUp).not.toHaveBeenCalled();
    expect(field('password-confirm').getAttribute('aria-label')).toBe(
      `${t('auth.fields.passwordConfirm')}, ${t('auth.errors.passwordMismatch')}`,
    );
  });

  it('once the two passwords match, a check says so', () => {
    renderSignUp();
    fillAll();
    expect(screen.getByTestId('sign-up.password-confirm.match').getAttribute('aria-label')).toBe(
      t('auth.hints.passwordMatch'),
    );
  });

  it('signs up with what was written and goes to type the code, waiting on the button', async () => {
    let finish: (outcome: 'verify') => void = () => undefined;
    vi.mocked(signUp).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderSignUp();
    fillAll();
    fireEvent.click(submit());
    expect(signUp).toHaveBeenCalledWith({
      displayName: 'Ana',
      email: 'ana@example.com',
      password: 'secreta12',
    });
    await vi.waitFor(() => expect(busy(submit())).toBe(true));
    finish('verify');
    await vi.waitFor(() =>
      expect(nav.router.push).toHaveBeenCalledWith({
        pathname: '/verify-email',
        params: { email: 'ana@example.com', name: 'Ana' },
      }),
    );
    expect(busy(submit())).toBe(false);
  });

  it('when the email is taken, says what to do instead without blaming', async () => {
    vi.mocked(signUp).mockRejectedValueOnce(new AuthFailure('EMAIL_TAKEN'));
    renderSignUp();
    fillAll();
    fireEvent.click(submit());
    expect((await screen.findByRole('alert')).textContent).toBe(t('auth.errors.EMAIL_TAKEN'));
    expect(nav.router.push).not.toHaveBeenCalled();
  });

  it('with an invitation waiting, says why to sign up', () => {
    renderSignUp({ pendingInvite: 'a'.repeat(48) });
    expect(screen.getByTestId('sign-up.pending-invite').textContent).toBe(t('auth.pendingInvite'));
  });

  it('«Entra» goes back to sign in', () => {
    renderSignUp();
    fireEvent.click(screen.getByRole('button', { name: t('auth.signUp.goSignIn') }));
    expect(nav.router.back).toHaveBeenCalled();
  });
});
