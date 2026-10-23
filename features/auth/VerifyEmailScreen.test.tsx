import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import VerifyEmailScreen from '@/app/(auth)/verify-email';
import { AuthFailure, resendSignUpCode, verifySignUpCode } from '@/features/auth/api';
import { t } from '@/i18n';

// The screen reads the email and name it was opened with, and sends back to /sign-up without one.
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
  Redirect: ({ href }: { href: string }) => <span data-testid="redirect" data-href={href} />,
}));
vi.mock('@/features/auth/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth/api')>()),
  verifySignUpCode: vi.fn(),
  resendSignUpCode: vi.fn(),
}));

const codeField = () => screen.getByTestId<HTMLInputElement>('verify-email.code');
const submit = () => screen.getByRole('button', { name: t('auth.verify.submit') });
const resendButton = () => screen.getByTestId('verify-email.resend');
/** A button at work shows a spinner in place of its label (its name stays). */
const busy = (button: HTMLElement) => within(button).queryByRole('progressbar') !== null;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifySignUpCode).mockReset();
  vi.mocked(resendSignUpCode).mockReset();
  nav.params = { email: 'ana@example.com', name: 'Ana' };
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Verificar correo', () => {
  it('says where the code went and names the field and buttons', () => {
    render(<VerifyEmailScreen />);
    expect(screen.getByRole('heading', { name: t('auth.verify.title') })).toBeTruthy();
    expect(screen.getByTestId('verify-email.body').textContent).toBe(
      t('auth.verify.body', { email: 'ana@example.com' }),
    );
    expect(codeField().getAttribute('aria-label')).toBe(t('auth.verify.code'));
    expect(submit()).toBeTruthy();
    expect(screen.getByRole('button', { name: t('auth.verify.changeEmail') })).toBeTruthy();
  });

  it('without an email to verify, goes back to sign up', () => {
    nav.params = {};
    render(<VerifyEmailScreen />);
    expect(screen.getByTestId('redirect').getAttribute('data-href')).toBe('/sign-up');
    expect(screen.queryByTestId('verify-email.code')).toBeNull();
  });

  it('a code that is not six digits is marked on the field and not sent', () => {
    render(<VerifyEmailScreen />);
    fireEvent.change(codeField(), { target: { value: '12a' } });
    fireEvent.click(submit());
    expect(verifySignUpCode).not.toHaveBeenCalled();
    expect(codeField().getAttribute('aria-label')).toBe(
      `${t('auth.verify.code')}, ${t('auth.errors.codeInvalid')}`,
    );
  });

  it('sends the code written, without its spaces, for this email, waiting on the button', async () => {
    let finish: () => void = () => undefined;
    vi.mocked(verifySignUpCode).mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    render(<VerifyEmailScreen />);
    fireEvent.change(codeField(), { target: { value: '123 456' } });
    fireEvent.click(submit());
    expect(verifySignUpCode).toHaveBeenCalledWith({ email: 'ana@example.com', code: '123456' });
    await vi.waitFor(() => expect(busy(submit())).toBe(true));
    finish();
    await vi.waitFor(() => expect(busy(submit())).toBe(false));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a wrong code says what to do next without blaming', async () => {
    vi.mocked(verifySignUpCode).mockRejectedValueOnce(new AuthFailure('INVALID_CODE'));
    render(<VerifyEmailScreen />);
    fireEvent.change(codeField(), { target: { value: '123456' } });
    fireEvent.click(submit());
    expect((await screen.findByRole('alert')).textContent).toBe(t('auth.errors.INVALID_CODE'));
  });

  it('waits a minute before offering to resend, with a hard space before the «s»', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-10-22T10:00:00Z'));
    render(<VerifyEmailScreen />);
    expect(resendButton().getAttribute('aria-label')).toBe('Reenviar en 60 s');
    expect(resendButton().getAttribute('aria-label')).toBe(
      t('auth.verify.resendIn', { seconds: 60 }),
    );
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(resendButton().getAttribute('aria-label')).toBe('Reenviar en 45 s');
    // Still counting down: a tap does nothing.
    fireEvent.click(resendButton());
    expect(resendSignUpCode).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(45_000);
    });
    expect(resendButton().getAttribute('aria-label')).toBe(t('auth.verify.resend'));
  });

  it('once the minute is over, resends to the same email and starts counting again', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-10-22T10:00:00Z'));
    vi.mocked(resendSignUpCode).mockResolvedValueOnce();
    render(<VerifyEmailScreen />);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    fireEvent.click(screen.getByRole('button', { name: t('auth.verify.resend') }));
    expect(resendSignUpCode).toHaveBeenCalledWith('ana@example.com');
    await vi.waitFor(() =>
      expect(resendButton().getAttribute('aria-label')).toBe(
        t('auth.verify.resendIn', { seconds: 60 }),
      ),
    );
  });

  it('when resending fails, says why', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-10-22T10:00:00Z'));
    vi.mocked(resendSignUpCode).mockRejectedValueOnce(new AuthFailure('RATE_LIMITED'));
    render(<VerifyEmailScreen />);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    fireEvent.click(resendButton());
    expect((await screen.findByRole('alert')).textContent).toBe(t('auth.errors.RATE_LIMITED'));
  });

  it('«Cambiar correo» goes back to sign up with the email and name', () => {
    render(<VerifyEmailScreen />);
    fireEvent.click(screen.getByRole('button', { name: t('auth.verify.changeEmail') }));
    expect(nav.router.replace).toHaveBeenCalledWith({
      pathname: '/sign-up',
      params: { email: 'ana@example.com', name: 'Ana' },
    });
  });
});
