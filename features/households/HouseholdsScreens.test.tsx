import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LicenseScreen from '@/app/household/license';
import { t } from '@/i18n';
import { DoorHeader, DoorHouseholdContext } from '@/ui/components/DoorHeader';
import { NoticeProvider } from '@/ui/components/Notice';
import { getHouseholdLicense, startHouseholdCheckout, type Membership } from './api';
import { licenseDate } from './billing';
import { HouseholdsList } from './HouseholdsList';
import { householdsKey, licenseKey, membersKey, membershipKey } from './keys';
import { LicenseBand } from './LicenseBand';

const nav = vi.hoisted(() => ({
  router: { push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: vi.fn(() => true) },
}));
vi.mock('expo-router', () => ({
  useRouter: () => nav.router,
  router: nav.router,
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  useIsFocused: () => true,
  useFocusEffect: () => undefined,
  useNavigation: () => ({ addListener: () => () => undefined, dispatch: vi.fn() }),
}));
vi.mock('@/features/auth/SessionProvider', () => ({
  useSession: () => ({ status: 'signed-in', userId: 'me' }),
}));
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  getHouseholdLicense: vi.fn(),
  startHouseholdCheckout: vi.fn(),
  listMembers: vi.fn(() => new Promise(() => undefined)),
}));

const casa: Membership = {
  householdId: 'casa',
  householdName: 'Casa',
  role: 'owner',
  rooms: [],
  memberCount: 2,
};
const mama: Membership = {
  householdId: 'mama',
  householdName: 'Casa de mamá',
  role: 'member',
  rooms: [],
  memberCount: 3,
};

function withClient(node: ReactNode, seed?: (client: QueryClient) => void) {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  seed?.(client);
  render(
    <QueryClientProvider client={client}>
      <NoticeProvider>{node}</NoticeProvider>
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('«Tus casas» (bloque 12)', () => {
  it('one note per household: the one shown says so and is the chosen one', () => {
    withClient(<HouseholdsList households={[casa, mama]} activeId="casa" onSwitch={vi.fn()} />);
    const shown = screen.getByTestId('households.casa');
    expect(shown.getAttribute('aria-selected')).toBe('true');
    expect(shown.getAttribute('aria-label')).toBe(
      `Casa, ${t('households.here')} · ${t('households.peopleOther', { count: 2 })} · ${t('households.leads')}`,
    );
    const other = screen.getByTestId('households.mama');
    expect(other.getAttribute('aria-selected')).toBe('false');
    expect(other.getAttribute('aria-label')).toBe(
      `Casa de mamá, ${t('households.peopleOther', { count: 3 })}`,
    );
  });

  it('tapping another household switches to it', () => {
    const onSwitch = vi.fn();
    withClient(<HouseholdsList households={[casa, mama]} activeId="casa" onSwitch={onSwitch} />);
    fireEvent.click(screen.getByTestId('households.mama'));
    expect(onSwitch).toHaveBeenCalledWith('mama');
  });

  it('under them, «Crear otra casa» with a border and «Unirme con un enlace»: no pósit', () => {
    const onLeave = vi.fn();
    withClient(
      <HouseholdsList households={[casa]} activeId="casa" onSwitch={vi.fn()} onLeave={onLeave} />,
    );
    fireEvent.click(screen.getByRole('button', { name: t('households.create') }));
    expect(onLeave).toHaveBeenCalled();
    expect(nav.router.push).toHaveBeenCalledWith('/household/new');
    fireEvent.click(screen.getByRole('button', { name: t('households.join') }));
    expect(nav.router.push).toHaveBeenCalledWith('/household/new?join=1');
  });
});

describe('the door names the household (bloque 12)', () => {
  const door = (value: { name: string; onPress?: () => void } | null, withHousehold = true) => (
    <DoorHouseholdContext.Provider value={value}>
      <DoorHeader
        eyebrow="Hoy"
        eyebrowDetail={{ long: 'lunes, 26 de octubre', short: 'lun, 26 oct' }}
        heading="Te toca 1."
        withHousehold={withHousehold}
      />
    </DoorHouseholdContext.Provider>
  );

  it('with a single household, nothing changes', () => {
    withClient(door(null));
    expect(screen.queryByTestId('door.household')).toBeNull();
    // The date as the window fits it, and nothing after it.
    expect(screen.getByRole('heading').textContent).toMatch(/^Hoy · lun[^·]*$/);
  });

  it('with several, the label names the one shown, with the short date, and opens «Tus casas»', () => {
    const open = vi.fn();
    withClient(door({ name: 'Casa de mamá', onPress: open }));
    expect(screen.getByRole('heading').textContent).toBe('Hoy · lun, 26 oct ·');
    const name = screen.getByRole('button', {
      name: t('households.door', { household: 'Casa de mamá' }),
    });
    expect(name.textContent).toContain('Casa de mamá');
    fireEvent.click(name);
    expect(open).toHaveBeenCalled();
  });

  it('Ajustes, which lists them, keeps its label', () => {
    withClient(door({ name: 'Casa de mamá', onPress: vi.fn() }, false));
    expect(screen.queryByTestId('door.household')).toBeNull();
  });
});

describe('the licence screen (bloque 12)', () => {
  const seed = (license: Membership['license'], role: Membership['role'] = 'owner') => {
    return (client: QueryClient) => {
      const membership = { ...casa, role, license };
      client.setQueryData(membershipKey, membership);
      client.setQueryData(householdsKey, [membership]);
      client.setQueryData(membersKey('casa'), [
        { userId: 'me', displayName: 'Brad', role: 'owner', joinedAt: '2026-10-01' },
        { userId: 'seg', displayName: 'Segundo', role: 'member', joinedAt: '2026-10-02' },
      ]);
    };
  };

  it('with billing off it says «Incluida por ahora» and has nothing to press', async () => {
    vi.mocked(getHouseholdLicense).mockResolvedValue({
      status: 'complimentary',
      paidBy: 'me',
      currentPeriodEnd: null,
      trialEndsAt: null,
    });
    withClient(<LicenseScreen />, seed(undefined));
    expect((await screen.findByTestId('license.state')).textContent).toBe(
      t('license.complimentary'),
    );
    expect(screen.getByText(t('license.complimentaryBody'))).toBeTruthy();
    expect(screen.queryByRole('button', { name: t('license.pay') })).toBeNull();
  });

  it('a database without licences reads as included too', async () => {
    vi.mocked(getHouseholdLicense).mockResolvedValue(null);
    withClient(<LicenseScreen />, seed(undefined));
    expect((await screen.findByTestId('license.state')).textContent).toBe(
      t('license.complimentary'),
    );
  });

  it('with billing on: the trial, who pays, the hand-over, and «Pagar la licencia» for whoever runs it', async () => {
    vi.stubEnv('EXPO_PUBLIC_BILLING_ENABLED', 'true');
    vi.stubEnv('EXPO_PUBLIC_LICENSE_PRICE', '2,99 €');
    const ends = '2099-11-09T10:00:00Z';
    vi.mocked(getHouseholdLicense).mockResolvedValue({
      status: 'trial',
      paidBy: 'me',
      currentPeriodEnd: null,
      trialEndsAt: ends,
    });
    vi.mocked(startHouseholdCheckout).mockResolvedValue({
      provider: 'revenuecat',
      offering: 'household_monthly',
      householdId: 'casa',
    });
    withClient(<LicenseScreen />, seed(undefined));
    expect((await screen.findByTestId('license.state')).textContent).toBe(
      t('license.trialUntil', { date: licenseDate(ends) }),
    );
    expect(screen.getByText('2,99 €')).toBeTruthy();
    expect(screen.getByTestId('license.payer').getAttribute('aria-label')).toBe(
      `${t('license.paidByLabel')}: ${t('license.paidByYou')}`,
    );
    expect(screen.getByText(t('license.transferNote'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('license.pay') }));
    await vi.waitFor(() => expect(startHouseholdCheckout).toHaveBeenCalledWith('casa'));
    expect(await screen.findByText(t('license.checkoutLater'))).toBeTruthy();
  });

  it('someone who does not run the household sees who pays, and no button', async () => {
    vi.stubEnv('EXPO_PUBLIC_BILLING_ENABLED', 'true');
    vi.mocked(getHouseholdLicense).mockResolvedValue({
      status: 'canceled',
      paidBy: 'me',
      currentPeriodEnd: '2020-11-03T10:00:00Z',
      trialEndsAt: null,
    });
    withClient(<LicenseScreen />, seed(undefined, 'member'));
    await screen.findByTestId('license.state');
    expect(screen.getByText(t('license.ownerPays'))).toBeTruthy();
    expect(screen.queryByRole('button', { name: t('license.pay') })).toBeNull();
  });
});

describe('LicenseBand (bloque 12)', () => {
  const band = (license: Membership['license']) =>
    withClient(<LicenseBand />, (client) => {
      client.setQueryData(membershipKey, { ...casa, license });
      client.setQueryData(licenseKey('casa'), null);
    });

  it('is not there while the household may write', () => {
    band({ status: 'complimentary', endsAt: null, licensed: true });
    expect(screen.queryByTestId('license.band')).toBeNull();
  });

  it('says when the licence ended and who can renew it, and leads to it', () => {
    const ended = '2020-11-03T10:00:00Z';
    band({ status: 'canceled', endsAt: ended, licensed: false });
    const shown = screen.getByTestId('license.band');
    expect(within(shown).getByText(t('license.band', { date: licenseDate(ended) }))).toBeTruthy();
    fireEvent.click(screen.getByTestId('license.band.open'));
    expect(nav.router.push).toHaveBeenCalledWith('/household/license');
  });
});
