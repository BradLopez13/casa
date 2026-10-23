import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AuthCallback from '@/app/auth/callback';
import { exchangeCodeOnce } from '@/features/auth/social/exchange';
import { t } from '@/i18n';

// The browser comes back with `?code=` (or `?error=`): the params are the test's to set.
const nav = vi.hoisted(() => ({
  params: {},
  router: { push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: vi.fn(() => true) },
}));
vi.mock('expo-router', () => ({
  useRouter: () => nav.router,
  router: nav.router,
  useLocalSearchParams: () => nav.params,
}));
vi.mock('@/features/auth/social/exchange', () => ({ exchangeCodeOnce: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(exchangeCodeOnce).mockReset();
  nav.params = {};
});

describe('Vuelta del navegador', () => {
  it('says it is signing in while the code is exchanged, and stays', async () => {
    vi.mocked(exchangeCodeOnce).mockReturnValue(new Promise<void>(() => undefined));
    nav.params = { code: 'abc' };
    render(<AuthCallback />);
    expect(screen.getByRole('progressbar').getAttribute('aria-label')).toBe(
      t('auth.callback.loading'),
    );
    expect(exchangeCodeOnce).toHaveBeenCalledWith('abc');
    await Promise.resolve();
    expect(nav.router.replace).not.toHaveBeenCalled();
  });

  it('when the exchange fails, sends to sign in with the error to show', async () => {
    vi.mocked(exchangeCodeOnce).mockRejectedValueOnce(new Error('expired'));
    nav.params = { code: 'abc' };
    render(<AuthCallback />);
    await vi.waitFor(() =>
      expect(nav.router.replace).toHaveBeenCalledWith({
        pathname: '/sign-in',
        params: { error: 'callback' },
      }),
    );
  });

  it('a cancelled sign-in goes back to sign in without an error', () => {
    nav.params = { error: 'access_denied' };
    render(<AuthCallback />);
    expect(exchangeCodeOnce).not.toHaveBeenCalled();
    expect(nav.router.replace).toHaveBeenCalledWith('/sign-in');
  });

  it('coming back with neither a code nor a cancellation is an error', () => {
    nav.params = { error: 'server_error' };
    render(<AuthCallback />);
    expect(exchangeCodeOnce).not.toHaveBeenCalled();
    expect(nav.router.replace).toHaveBeenCalledWith({
      pathname: '/sign-in',
      params: { error: 'callback' },
    });
  });
});
