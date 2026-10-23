import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SignInScreen from '@/app/(auth)/sign-in';
import { AuthFailure, signIn } from '@/features/auth/api';
import { pendingInviteKey } from '@/features/households/pending-invite';
import { t } from '@/i18n';

// The screen reads `?error=callback`: the router's params are the test's to set.
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
  signIn: vi.fn(),
}));
// Google and Apple are tested apart; here they are switched off.
vi.mock('@/features/auth/social/SocialButtons', () => ({ SocialButtons: () => null }));

function renderSignIn({ pendingInvite = null }: { pendingInvite?: string | null } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  queryClient.setQueryData(pendingInviteKey, pendingInvite);
  render(
    <QueryClientProvider client={queryClient}>
      <SignInScreen />
    </QueryClientProvider>,
  );
}

const emailField = () => screen.getByTestId<HTMLInputElement>('sign-in.email');
const passwordField = () => screen.getByTestId<HTMLInputElement>('sign-in.password');
const submit = () => screen.getByRole('button', { name: t('auth.signIn.submit') });
/** A button at work shows a spinner in place of its label (its name stays). */
const busy = (button: HTMLElement) => within(button).queryByRole('progressbar') !== null;

function fill(email: string, password: string) {
  fireEvent.change(emailField(), { target: { value: email } });
  fireEvent.change(passwordField(), { target: { value: password } });
}

beforeEach(() => {
  vi.mocked(signIn).mockReset();
  nav.params = {};
  vi.clearAllMocks();
});

describe('Iniciar sesión', () => {
  it('names each field and button for a screen reader', () => {
    renderSignIn();
    expect(screen.getByRole('heading', { name: t('auth.signIn.title') })).toBeTruthy();
    expect(emailField().getAttribute('aria-label')).toBe(t('auth.fields.email'));
    expect(passwordField().getAttribute('aria-label')).toBe(t('auth.fields.password'));
    expect(submit()).toBeTruthy();
    expect(screen.getByRole('button', { name: t('auth.forgot.link') })).toBeTruthy();
    expect(screen.getByRole('button', { name: t('auth.signIn.goSignUp') })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows and hides the password with a button that says which', () => {
    renderSignIn();
    expect(passwordField().type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: t('auth.password.show') }));
    expect(passwordField().type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: t('auth.password.hide') }));
    expect(passwordField().type).toBe('password');
  });

  it('with nothing written, says what is missing in the field and does not call the server', () => {
    renderSignIn();
    fireEvent.click(submit());
    expect(signIn).not.toHaveBeenCalled();
    expect(emailField().getAttribute('aria-label')).toBe(
      `${t('auth.fields.email')}, ${t('auth.errors.emailInvalid')}`,
    );
    expect(passwordField().getAttribute('aria-label')).toBe(
      `${t('auth.fields.password')}, ${t('auth.errors.passwordRequired')}`,
    );
  });

  it('signs in with what was written, the email trimmed, and waits on the button', async () => {
    let finish: () => void = () => undefined;
    vi.mocked(signIn).mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    renderSignIn();
    fill('  ana@example.com ', 'secreta1');
    fireEvent.click(submit());
    expect(signIn).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'secreta1' });
    await vi.waitFor(() => expect(busy(submit())).toBe(true));
    finish();
    await vi.waitFor(() => expect(busy(submit())).toBe(false));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('when the password does not match, says so without blaming and lets them try again', async () => {
    vi.mocked(signIn).mockRejectedValueOnce(new AuthFailure('INVALID_CREDENTIALS'));
    renderSignIn();
    fill('ana@example.com', 'mala');
    fireEvent.click(submit());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(t('auth.errors.INVALID_CREDENTIALS'));
    expect(busy(submit())).toBe(false);
  });

  it('without a connection, says so', async () => {
    vi.mocked(signIn).mockRejectedValueOnce(new AuthFailure('NETWORK'));
    renderSignIn();
    fill('ana@example.com', 'secreta1');
    fireEvent.click(submit());
    expect((await screen.findByRole('alert')).textContent).toBe(t('auth.errors.NETWORK'));
  });

  it('an unconfirmed email goes to type the code, carrying the email', async () => {
    vi.mocked(signIn).mockRejectedValueOnce(new AuthFailure('EMAIL_NOT_CONFIRMED'));
    renderSignIn();
    fill('ana@example.com', 'secreta1');
    fireEvent.click(submit());
    await vi.waitFor(() =>
      expect(nav.router.push).toHaveBeenCalledWith({
        pathname: '/verify-email',
        params: { email: 'ana@example.com' },
      }),
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('after a browser sign-in that came back without a code, says it did not work', () => {
    nav.params = { error: 'callback' };
    renderSignIn();
    expect(screen.getByRole('alert').textContent).toBe(t('auth.errors.UNKNOWN'));
  });

  it('with an invitation waiting, says why to sign in', () => {
    renderSignIn({ pendingInvite: 'a'.repeat(48) });
    expect(screen.getByTestId('sign-in.pending-invite').textContent).toBe(t('auth.pendingInvite'));
  });

  it('the forgotten-password link carries the email written so far', () => {
    renderSignIn();
    fireEvent.change(emailField(), { target: { value: ' ana@example.com ' } });
    fireEvent.click(screen.getByRole('button', { name: t('auth.forgot.link') }));
    expect(nav.router.push).toHaveBeenCalledWith({
      pathname: '/forgot-password',
      params: { email: 'ana@example.com' },
    });
  });
});
