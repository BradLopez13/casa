import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HelpRoute from '@/app/help';
import type { Member, Membership } from '@/features/households/api';
import { membersKey, membershipKey } from '@/features/households/keys';
import { resetHints } from '@/features/hints/hints';
import { t } from '@/i18n';

vi.mock('@/features/hints/hints', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/hints/hints')>()),
  resetHints: vi.fn(),
}));
vi.mock('@/features/auth/SessionProvider', () => ({
  useSession: () => ({ status: 'signed-in', userId: 'me' }),
}));

const membership: Membership = {
  householdId: 'h',
  householdName: 'Casa',
  role: 'owner',
  rooms: ['kitchen'],
};

function renderHelp(members: Member[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  queryClient.setQueryData(membershipKey, membership);
  queryClient.setQueryData(membersKey('h'), members);
  render(
    <QueryClientProvider client={queryClient}>
      <HelpRoute />
    </QueryClientProvider>,
  );
}

describe('Cómo funciona Nido', () => {
  it('lists what the screens do not show, the magnets, Hoy and Tareas and earlier days too', () => {
    renderHelp([{ userId: 'me', displayName: 'Ana', role: 'owner', joinedAt: '2026-10-01' }]);
    for (const key of [
      'write',
      'assign',
      'magnets',
      'tabs',
      'earlier',
      'swipe',
      'refresh',
      'shopping',
      'quantity',
      'invite',
    ] as const) {
      expect(screen.getByText(t(`help.${key}.title`))).toBeTruthy();
    }
    expect(screen.getByTestId('help.back')).toBeTruthy();
  });

  it('writes the example for someone of the household', () => {
    renderHelp([
      { userId: 'me', displayName: 'Ana', role: 'owner', joinedAt: '2026-10-01' },
      { userId: 'bo', displayName: 'Bo Ruiz', role: 'member', joinedAt: '2026-10-02' },
    ]);
    expect(screen.getByText(t('help.write.body', { name: 'Bo' }))).toBeTruthy();
  });

  it('teaches the quick add with an example other than the hint’s (fase 10d)', () => {
    renderHelp([{ userId: 'me', displayName: 'Ana', role: 'owner', joinedAt: '2026-10-01' }]);
    const body = screen.getByTestId('help.write').textContent ?? '';
    expect(body).not.toContain(t('tasks.quickHint.exampleAlone'));
  });

  it('brings every first-use hint back on request, and says so', () => {
    renderHelp([{ userId: 'me', displayName: 'Ana', role: 'owner', joinedAt: '2026-10-01' }]);
    fireEvent.click(screen.getByTestId('help.again'));
    expect(resetHints).toHaveBeenCalledTimes(1);
    expect(screen.getByText(t('help.againDone'))).toBeTruthy();
  });
});
