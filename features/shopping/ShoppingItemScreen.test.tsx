import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EditShoppingItemRoute from '@/app/shopping/[id]';
import { AppError } from '@/data/supabase/errors';
import type { ShoppingItem } from '@/domain/shopping/list';
import type { Membership } from '@/features/households/api';
import { membershipKey } from '@/features/households/keys';
import { t } from '@/i18n';
import { NoticeProvider } from '@/ui/components/Notice';
import { deleteShoppingItem, listShoppingItems, updateShoppingItem } from './api';
import { shoppingKey } from './queries';

// The sheet reads its id from the route, and closes through `navigation.isFocused()`.
const nav = vi.hoisted(() => {
  const params: Record<string, string> = { id: 'Leche' };
  return {
    router: { push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: () => true },
    params,
  };
});
vi.mock('expo-router', () => ({
  useRouter: () => nav.router,
  router: nav.router,
  useNavigation: () => ({
    addListener: () => () => undefined,
    dispatch: vi.fn(),
    isFocused: () => true,
  }),
  useLocalSearchParams: () => nav.params,
  useFocusEffect: () => undefined,
  useSegments: () => [],
  useIsFocused: () => true,
}));
vi.mock('@/features/auth/SessionProvider', () => ({
  useSession: () => ({ status: 'signed-in', userId: 'me' }),
}));
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  listShoppingItems: vi.fn(),
  updateShoppingItem: vi.fn(),
  deleteShoppingItem: vi.fn(),
}));

const membership: Membership = {
  householdId: 'h',
  householdName: 'Casa',
  role: 'owner',
  rooms: ['kitchen'],
};

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

/** The product's sheet with the household cached; `items` undefined loads them. */
function renderSheet(items?: ShoppingItem[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  queryClient.setQueryData(membershipKey, membership);
  if (items) queryClient.setQueryData(shoppingKey('h'), items);
  render(
    <QueryClientProvider client={queryClient}>
      <NoticeProvider>
        <EditShoppingItemRoute />
      </NoticeProvider>
    </QueryClientProvider>,
  );
}

const disabled = (testID: string) => screen.getByTestId(testID).getAttribute('aria-disabled');

beforeEach(() => {
  vi.mocked(listShoppingItems).mockReset();
  vi.mocked(updateShoppingItem).mockReset().mockResolvedValue(undefined);
  vi.mocked(deleteShoppingItem).mockReset().mockResolvedValue(undefined);
  nav.router.back.mockClear();
  nav.params = { id: 'Leche' };
  onlineManager.setOnline(true);
});

describe('Hoja de producto', () => {
  it('names its controls: the name, the quantity magnet, Guardar, Cancelar and Borrar', () => {
    renderSheet([item('Leche')]);
    const name = screen.getByTestId<HTMLInputElement>('shopping.edit.name');
    expect(name.value).toBe('Leche');
    expect(name.getAttribute('aria-label')).toBe(t('shopping.edit.name'));
    expect(screen.getByRole('button', { name: t('shopping.edit.quantityNone') })).toBeTruthy();
    expect(screen.getByRole('button', { name: t('shopping.edit.save') })).toBeTruthy();
    expect(screen.getByRole('button', { name: t('shopping.edit.cancel') })).toBeTruthy();
    expect(screen.getByRole('button', { name: t('shopping.edit.delete') })).toBeTruthy();
  });

  it('the quantity magnet says the quantity and shows the scale', () => {
    renderSheet([item('Leche', { quantity: '2' })]);
    const chip = screen.getByTestId('shopping.edit.quantity-chip');
    expect(chip.getAttribute('aria-label')).toBe(`${t('shopping.edit.quantityLabel')}, 2`);
    expect(chip.querySelector('[data-icon="scale-outline"]')).not.toBeNull();
    // Fase 10f: the same property magnet as the task's, its field named over the value.
    expect(chip.textContent).toBe(`${t('shopping.edit.quantityLabel')}2`);
  });

  it('opens with Guardar disabled, and enables it once the name changes', () => {
    renderSheet([item('Leche')]);
    expect(disabled('shopping.edit.save')).toBe('true');
    fireEvent.change(screen.getByTestId('shopping.edit.name'), {
      target: { value: 'Leche sin lactosa' },
    });
    expect(disabled('shopping.edit.save')).not.toBe('true');
  });

  it('saves the new name and closes', async () => {
    renderSheet([item('Leche')]);
    fireEvent.change(screen.getByTestId('shopping.edit.name'), {
      target: { value: 'Leche sin lactosa' },
    });
    fireEvent.click(screen.getByTestId('shopping.edit.save'));
    await vi.waitFor(() =>
      expect(updateShoppingItem).toHaveBeenCalledWith('Leche', 'Leche sin lactosa', null),
    );
    await vi.waitFor(() => expect(nav.router.back).toHaveBeenCalledTimes(1));
  });

  // Decisión 2 de Brad (27 de octubre, A): a product touches nobody but the list.
  it('deleting closes at once with «Deshacer», and undoing keeps the product', () => {
    renderSheet([item('Leche')]);
    fireEvent.click(screen.getByTestId('shopping.edit.delete'));
    expect(nav.router.back).toHaveBeenCalledTimes(1);
    expect(screen.getByText(t('shopping.deleted'))).toBeTruthy();
    expect(deleteShoppingItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('notice.undo'));
    expect(deleteShoppingItem).not.toHaveBeenCalled();
  });

  it('offline, shows the band; Guardar and Borrar wait for the connection', () => {
    onlineManager.setOnline(false);
    renderSheet([item('Leche')]);
    expect(screen.getByTestId('shopping.offline').getAttribute('aria-label')).toBe(
      t('shopping.offline'),
    );
    fireEvent.change(screen.getByTestId('shopping.edit.name'), { target: { value: 'Pan' } });
    expect(disabled('shopping.edit.save')).toBe('true');
    expect(disabled('shopping.edit.delete')).toBe('true');
  });

  it('online, there is no offline band', () => {
    renderSheet([item('Leche')]);
    expect(screen.queryByTestId('shopping.offline')).toBeNull();
  });

  it('while the list loads, shows a spinner', () => {
    vi.mocked(listShoppingItems).mockReturnValue(new Promise(() => undefined));
    renderSheet();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByTestId('shopping.edit.name')).toBeNull();
  });

  it('when the list never loaded, says why and offers «Cerrar»', async () => {
    vi.mocked(listShoppingItems).mockRejectedValue(new AppError('NETWORK'));
    onlineManager.setOnline(false);
    renderSheet();
    const error = await screen.findByTestId('shopping.edit.not-found');
    expect(error.textContent).toBe(t('shopping.errors.NETWORK'));
    fireEvent.click(screen.getByRole('button', { name: t('taskForm.close') }));
    expect(nav.router.back).toHaveBeenCalledTimes(1);
  });

  it('a product already bought, or gone, says it is no longer on the list', () => {
    renderSheet([item('Leche', { boughtAt: '2026-10-21T08:00:00.000Z', boughtBy: 'me' })]);
    expect(screen.getByTestId('shopping.edit.not-found').textContent).toBe(
      t('shopping.errors.ITEM_NOT_FOUND'),
    );
  });
});
