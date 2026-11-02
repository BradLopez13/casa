import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteAccount } from './api';
import { revokeAppleSignIn } from './social/revoke';
import { useDeleteAccount } from './useDeleteAccount';

vi.mock('./SessionProvider', () => ({ useSession: () => ({ status: 'signed-in', userId: 'me' }) }));
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  deleteAccount: vi.fn(),
  signOutLocally: vi.fn(),
}));
vi.mock('./social/revoke', () => ({ revokeAppleSignIn: vi.fn() }));
vi.mock('@/features/push/registration', () => ({ clearPushRegistration: vi.fn() }));
vi.mock('@/features/reminders/storage', () => ({ clearReminderSettings: vi.fn() }));
vi.mock('@/features/households/pending-invite', () => ({
  pendingInvite: { clear: vi.fn().mockResolvedValue(undefined) },
}));

beforeEach(() => {
  vi.mocked(deleteAccount).mockReset().mockResolvedValue();
  vi.mocked(revokeAppleSignIn).mockReset().mockResolvedValue(true);
});

// Bloque 15.4: App Review asks that deleting the account revokes the Sign in with Apple token.
describe('useDeleteAccount', () => {
  it('revokes the Apple token before the account goes', async () => {
    const order: string[] = [];
    vi.mocked(revokeAppleSignIn).mockImplementation(() => {
      order.push('revoke');
      return Promise.resolve(true);
    });
    vi.mocked(deleteAccount).mockImplementation(() => {
      order.push('delete');
      return Promise.resolve();
    });
    const client = new QueryClient();
    const { result } = renderHook(() => useDeleteAccount(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    await act(async () => {
      result.current.run({ onError: () => undefined });
      await vi.waitFor(() => expect(deleteAccount).toHaveBeenCalled());
    });
    expect(order).toEqual(['revoke', 'delete']);
  });
});
