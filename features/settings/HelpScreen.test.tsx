import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HelpRoute from '@/app/help';
import type { Member, Membership } from '@/features/households/api';
import { membersKey, membershipKey } from '@/features/households/keys';
import { t } from '@/i18n';

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
  it('lists the five things the screens do not show', () => {
    renderHelp([{ userId: 'me', displayName: 'Ana', role: 'owner', joinedAt: '2026-10-01' }]);
    for (const key of ['write', 'swipe', 'refresh', 'quantity', 'invite'] as const) {
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
});
