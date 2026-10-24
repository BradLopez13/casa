import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ForgotPasswordScreen from '@/app/(auth)/forgot-password';
import { AuthFailure, requestPasswordReset, resetPassword } from '@/features/auth/api';
import { t } from '@/i18n';

// Sign in opens this screen with the email written so far: the params are the test's to set.
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
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}));

const input = (id: 'email' | 'code' | 'password' | 'password-confirm') =>
  screen.getByTestId<HTMLInputElement>(`forgot-password.${id}`);
const type = (id: Parameters<typeof input>[0], value: string) =>
  fireEvent.change(input(id), { target: { value } });
const sendButton = () => screen.getByRole('button', { name: t('auth.forgot.send') });
const saveButton = () => screen.getByRole('button', { name: t('auth.forgot.submit') });
/** A button at work shows a spinner in place of its label (its name stays). */
const busy = (button: HTMLElement) => within(button).queryByRole('progressbar') !== null;

/** Past the first step: the code was sent to ana@example.com. */
async function toCodeStep() {
  vi.mocked(requestPasswordReset).mockResolvedValueOnce();
  render(<ForgotPasswordScreen />);
  type('email', 'ana@example.com');
  fireEvent.click(sendButton());
  await screen.findByTestId('forgot-password.sent');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requestPasswordReset).mockReset();
  vi.mocked(resetPassword).mockReset();
  nav.params = {};
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Recuperar contraseña: el correo', () => {
  it('says what will happen and names the field and buttons', () => {
    render(<ForgotPasswordScreen />);
    expect(screen.getByRole('heading', { name: t('auth.forgot.title') })).toBeTruthy();
    expect(screen.getByText(t('auth.forgotContext'))).toBeTruthy();
    expect(input('email').getAttribute('aria-label')).toBe(t('auth.fields.email'));
    expect(sendButton()).toBeTruthy();
    expect(screen.getByRole('button', { name: t('auth.backToSignIn') })).toBeTruthy();
  });

  it('starts from the email sign in had', () => {
    nav.params = { email: 'ana@example.com' };
    render(<ForgotPasswordScreen />);
    expect(input('email').value).toBe('ana@example.com');
  });

  it('an invalid email is marked on the field and nothing is sent', () => {
    render(<ForgotPasswordScreen />);
    type('email', 'ana@');
    fireEvent.click(sendButton());
    expect(requestPasswordReset).not.toHaveBeenCalled();
    expect(input('email').getAttribute('aria-label')).toBe(
      `${t('auth.fields.email')}, ${t('auth.errors.emailInvalid')}`,
    );
  });

  it('sends the code to the email written, trimmed, waiting on the button', async () => {
    let finish: () => void = () => undefined;
    vi.mocked(requestPasswordReset).mockReturnValue(
      new Promise<void>((resolve) => (finish = resolve)),
    );
    render(<ForgotPasswordScreen />);
    type('email', ' ana@example.com ');
    fireEvent.click(sendButton());
    expect(requestPasswordReset).toHaveBeenCalledWith('ana@example.com');
    await vi.waitFor(() => expect(busy(sendButton())).toBe(true));
    finish();
    expect((await screen.findByTestId('forgot-password.sent')).textContent).toBe(
      t('auth.forgot.sent'),
    );
  });

  it('without a connection, says so and stays on the email', async () => {
    vi.mocked(requestPasswordReset).mockRejectedValueOnce(new AuthFailure('NETWORK'));
    render(<ForgotPasswordScreen />);
    type('email', 'ana@example.com');
    fireEvent.click(sendButton());
    expect((await screen.findByRole('alert')).textContent).toBe(t('auth.errors.NETWORK'));
    expect(screen.queryByTestId('forgot-password.code')).toBeNull();
  });

  it('«Volver a iniciar sesión» goes back', () => {
    render(<ForgotPasswordScreen />);
    fireEvent.click(screen.getByRole('button', { name: t('auth.backToSignIn') }));
    expect(nav.router.back).toHaveBeenCalled();
  });
});

describe('Recuperar contraseña: el código y la contraseña nueva', () => {
  it('names the code, the two passwords with their eyes, and the buttons', async () => {
    await toCodeStep();
    expect(screen.queryByText(t('auth.forgotContext'))).toBeNull();
    expect(input('code').getAttribute('aria-label')).toBe(t('auth.verify.code'));
    expect(input('password').getAttribute('aria-label')).toBe(t('auth.forgot.newPassword'));
    expect(input('password-confirm').getAttribute('aria-label')).toBe(
      t('auth.fields.passwordConfirm'),
    );
    expect(screen.getAllByRole('button', { name: t('auth.password.show') })).toHaveLength(2);
    expect(saveButton()).toBeTruthy();
    expect(screen.getByText(t('auth.hints.passwordRule'))).toBeTruthy();
  });

  it('the eye shows and hides the new password', async () => {
    await toCodeStep();
    fireEvent.click(screen.getByTestId('forgot-password.password.toggle'));
    expect(input('password').type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: t('auth.password.hide') }));
    expect(input('password').type).toBe('password');
  });

  it('with nothing written, marks each field and does not call the server', async () => {
    await toCodeStep();
    fireEvent.click(saveButton());
    expect(resetPassword).not.toHaveBeenCalled();
    expect(input('code').getAttribute('aria-label')).toBe(
      `${t('auth.verify.code')}, ${t('auth.errors.codeInvalid')}`,
    );
    expect(input('password').getAttribute('aria-label')).toBe(
      `${t('auth.forgot.newPassword')}, ${t('auth.errors.passwordTooShort')}`,
    );
    expect(input('password-confirm').getAttribute('aria-label')).toBe(
      `${t('auth.fields.passwordConfirm')}, ${t('auth.errors.passwordConfirmRequired')}`,
    );
  });

  it('saves the new password with the code for that email', async () => {
    vi.mocked(resetPassword).mockResolvedValueOnce();
    await toCodeStep();
    type('code', '123-456');
    type('password', 'nueva1234');
    type('password-confirm', 'nueva1234');
    fireEvent.click(saveButton());
    expect(resetPassword).toHaveBeenCalledWith({
      email: 'ana@example.com',
      code: '123456',
      password: 'nueva1234',
    });
  });

  it('a wrong code says what to do next without blaming', async () => {
    vi.mocked(resetPassword).mockRejectedValueOnce(new AuthFailure('INVALID_CODE'));
    await toCodeStep();
    type('code', '123456');
    type('password', 'nueva1234');
    type('password-confirm', 'nueva1234');
    fireEvent.click(saveButton());
    expect((await screen.findByRole('alert')).textContent).toBe(t('auth.errors.INVALID_CODE'));
  });

  it('counts down a minute before resending, with a hard space before the «s»', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-10-22T10:00:00Z'));
    await toCodeStep();
    const resend = () => screen.getByTestId('forgot-password.resend');
    expect(resend().getAttribute('aria-label')).toBe('Reenviar en 60 s');
    fireEvent.click(resend());
    expect(requestPasswordReset).toHaveBeenCalledTimes(1);
    // The countdown's interval is armed in a passive effect; under load it could still be pending
    // when the clock moved, and the minute went by with no interval to see it (flaky in CI).
    await act(async () => {});
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(resend().getAttribute('aria-label')).toBe(t('auth.verify.resend'));
    vi.mocked(requestPasswordReset).mockResolvedValueOnce();
    fireEvent.click(resend());
    expect(requestPasswordReset).toHaveBeenLastCalledWith('ana@example.com');
    await vi.waitFor(() =>
      expect(resend().getAttribute('aria-label')).toBe(t('auth.verify.resendIn', { seconds: 60 })),
    );
  });
});
