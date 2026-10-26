import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { router } from 'expo-router';
import ShoppingScreen from '@/app/(tabs)/shopping';
import { AppError } from '@/data/supabase/errors';
import type { ShoppingItem } from '@/domain/shopping/list';
import type { Member, Membership } from '@/features/households/api';
import { membersKey, membershipKey } from '@/features/households/keys';
import { t } from '@/i18n';
import { NoticeProvider } from '@/ui/components/Notice';
import { listShoppingItems, shoppingHistory } from './api';
import { shoppingHistoryKey, shoppingKey } from './queries';

vi.mock('@/features/auth/SessionProvider', () => ({
  useSession: () => ({ status: 'signed-in', userId: 'me' }),
}));
vi.mock('@/features/hints/hints', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/hints/hints')>()),
  useHint: () => false,
}));
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  listShoppingItems: vi.fn(),
  shoppingHistory: vi.fn(),
}));

const membership: Membership = {
  householdId: 'h',
  householdName: 'Casa',
  role: 'owner',
  rooms: ['kitchen'],
};
const members: Member[] = [
  { userId: 'me', displayName: 'Ana', role: 'owner', joinedAt: '2026-10-01' },
  { userId: 'bo', displayName: 'Bo', role: 'member', joinedAt: '2026-10-02' },
];

function item(id: string, patch: Partial<ShoppingItem> = {}): ShoppingItem {
  return {
    id,
    name: id,
    normalizedName: id.toLowerCase(),
    quantity: null,
    createdAt: '2026-10-20T08:00:00.000Z',
    createdBy: 'me',
    boughtAt: null,
    boughtBy: null,
    ...patch,
  };
}

/** Compra with the household cached; `items` undefined loads them through `listShoppingItems`. */
function renderShopping(items?: ShoppingItem[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  queryClient.setQueryData(membershipKey, membership);
  queryClient.setQueryData(membersKey('h'), members);
  queryClient.setQueryData(shoppingHistoryKey('h'), []);
  if (items) queryClient.setQueryData(shoppingKey('h'), items);
  render(
    <QueryClientProvider client={queryClient}>
      <NoticeProvider>
        <ShoppingScreen />
      </NoticeProvider>
    </QueryClientProvider>,
  );
}

/** The window at `width` × `height`: react-native-web measures the document element. */
function windowSize(width: number, height: number) {
  const root = document.documentElement;
  Object.defineProperty(root, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(root, 'clientHeight', { value: height, configurable: true });
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
}

beforeEach(() => {
  vi.mocked(listShoppingItems).mockReset();
  vi.mocked(shoppingHistory).mockReset().mockResolvedValue([]);
  vi.mocked(router.push).mockClear();
  onlineManager.setOnline(true);
  // A phone held upright: one column.
  windowSize(400, 860);
});

describe('Compra', () => {
  it('names the field, the add button and each row’s box', () => {
    renderShopping([item('Leche')]);
    expect(screen.getByTestId('shopping.input').getAttribute('aria-label')).toBe(
      t('shopping.input'),
    );
    expect(screen.getByRole('button', { name: t('shopping.add') })).toBeTruthy();
    expect(
      screen.getByRole('checkbox', { name: t('shopping.a11y.mark', { name: 'Leche' }) }),
    ).toBeTruthy();
    expect(screen.getByTestId('shopping.door-line').textContent).toContain('1');
  });

  it('each row’s quantity carries the scale before its value', () => {
    renderShopping([item('Leche'), item('Pan', { quantity: '2' })]);
    for (const id of ['Leche', 'Pan']) {
      const pill = screen.getByTestId(`shopping.item.${id}.quantity`);
      expect(pill.querySelector('[data-icon="scale-outline"]')).not.toBeNull();
    }
    expect(screen.getByTestId('shopping.item.Pan.quantity').textContent).toContain('2');
  });

  it('with something in the bag, offers «Vaciar bolsa»', () => {
    renderShopping([
      item('Leche'),
      item('Pan', { boughtAt: '2026-10-21T08:00:00.000Z', boughtBy: 'me' }),
    ]);
    const clear = screen.getByTestId('shopping.clear');
    expect(clear.getAttribute('aria-label')).toBe(t('shopping.clear'));
    expect(clear.getAttribute('aria-disabled')).not.toBe('true');
  });

  it('with nothing bought, there is no «Vaciar bolsa»', () => {
    renderShopping([item('Leche')]);
    expect(screen.queryByTestId('shopping.clear')).toBeNull();
  });

  it('empty, links to the help on how the shopping works', () => {
    renderShopping([]);
    expect(screen.getByTestId('shopping.door-line').textContent).toBe(t('shopping.lineNone'));
    const help = screen.getByTestId('shopping.help');
    expect(help.getAttribute('aria-label')).toBe(t('help.link'));
    fireEvent.click(help);
    expect(vi.mocked(router.push)).toHaveBeenCalledWith('/help?entry=shopping');
  });

  it('while the list loads, shows a spinner and no help link', () => {
    vi.mocked(listShoppingItems).mockReturnValue(new Promise(() => undefined));
    renderShopping();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByTestId('shopping.help')).toBeNull();
  });

  it('when the list never loaded, shows the error with «Reintentar», which loads again', async () => {
    vi.mocked(listShoppingItems).mockRejectedValue(new AppError('NETWORK'));
    // Offline the load is tried once and not again (fase 10e): the error shows at once.
    onlineManager.setOnline(false);
    renderShopping();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(t('shopping.errors.NETWORK'));
    vi.mocked(listShoppingItems).mockResolvedValue([item('Leche')]);
    onlineManager.setOnline(true);
    fireEvent.click(screen.getByRole('button', { name: t('errors.retry') }));
    await vi.waitFor(() => expect(screen.getByTestId('shopping.item.Leche')).toBeTruthy());
  });

  it('offline, shows the band and keeps the list; «Vaciar bolsa» waits for the connection', () => {
    onlineManager.setOnline(false);
    renderShopping([item('Pan', { boughtAt: '2026-10-21T08:00:00.000Z', boughtBy: 'me' })]);
    expect(screen.getByTestId('shopping.offline').getAttribute('aria-label')).toBe(
      t('shopping.offline'),
    );
    const clear = screen.getByTestId('shopping.clear');
    expect(clear.getAttribute('aria-disabled')).toBe('true');
    // What looks off says why it waits (bloque 11), on screen and to the reader.
    expect(screen.getByTestId('shopping.clear-why').textContent).toBe(t('shopping.clearNeedsNet'));
    expect(clear.getAttribute('aria-label')).toBe(
      `${t('shopping.clear')}. ${t('shopping.clearWaits')}`,
    );
  });

  it('online, there is no offline band', () => {
    renderShopping([item('Leche')]);
    expect(screen.queryByTestId('shopping.offline')).toBeNull();
  });
});
