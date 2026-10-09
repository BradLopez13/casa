import { MutationObserver, onlineManager, QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/data/supabase/errors';
import type { ShoppingItem } from '@/domain/shopping/list';
import { addShoppingItem, setItemBought } from './api';
import {
  addKey,
  boughtKey,
  buildShoppingMutationDefaults,
  persistBuster,
  shouldPersistMutation,
  shouldPersistQuery,
  type AddVars,
  type BoughtVars,
} from './offline';

vi.mock('./api', () => ({ addShoppingItem: vi.fn(), setItemBought: vi.fn() }));

const key = ['shopping', 'h'];

const milk: AddVars = { id: 'a', householdId: 'h', name: 'Leche', quantity: null, userId: 'me' };

const existing: ShoppingItem = {
  id: 'x',
  name: 'Leche',
  normalizedName: 'leche',
  quantity: '2',
  createdAt: '2026-10-01T00:00:00.000Z',
  createdBy: 'other',
  boughtAt: null,
  boughtBy: null,
};

function setup() {
  const queryClient = new QueryClient();
  const notify = vi.fn();
  const defaults = buildShoppingMutationDefaults(queryClient, notify);
  queryClient.setMutationDefaults(addKey, defaults.add);
  queryClient.setMutationDefaults(boughtKey, defaults.bought);
  const add = (vars: AddVars) =>
    new MutationObserver<string, AppError, AddVars>(queryClient, { mutationKey: addKey }).mutate(
      vars,
    );
  const bought = (vars: BoughtVars) =>
    new MutationObserver<void, AppError, BoughtVars>(queryClient, {
      mutationKey: boughtKey,
    }).mutate(vars);
  return { queryClient, notify, defaults, add, bought };
}

const list = (queryClient: QueryClient) => queryClient.getQueryData<ShoppingItem[]>(key);

beforeEach(() => {
  vi.mocked(addShoppingItem).mockReset();
  vi.mocked(setItemBought).mockReset();
});

afterEach(() => {
  onlineManager.setOnline(true);
});

describe('shouldPersistQuery', () => {
  it('keeps only the shopping list and its history', () => {
    expect(shouldPersistQuery(['shopping', 'h'])).toBe(true);
    expect(shouldPersistQuery(['shopping-history', 'h'])).toBe(true);
    expect(shouldPersistQuery(['tasks', 'h'])).toBe(false);
    expect(shouldPersistQuery(['membership'])).toBe(false);
  });
});

describe('shouldPersistMutation', () => {
  it('keeps only the queued shopping mutations, whose functions are registered at start', () => {
    expect(shouldPersistMutation(addKey)).toBe(true);
    expect(shouldPersistMutation(boughtKey)).toBe(true);
    expect(shouldPersistMutation(['shopping', 'edit'])).toBe(false);
    expect(shouldPersistMutation(['tasks', 'toggle'])).toBe(false);
    expect(shouldPersistMutation(undefined)).toBe(false);
  });
});

describe('persistBuster', () => {
  it('ties the cache to the app version and the user', () => {
    expect(persistBuster('1.0.0', 'u1')).toBe('1.0.0:u1');
    expect(persistBuster('1.0.0', null)).toBe('1.0.0:anon');
  });
});

describe('buildShoppingMutationDefaults', () => {
  it('queues add and bought offline and sends them in order when back online', async () => {
    const { queryClient, add, bought } = setup();
    queryClient.setQueryData(key, []);
    onlineManager.setOnline(false);

    const added = add(milk);
    const marked = bought({ id: 'a', householdId: 'h', bought: true, userId: 'me' });

    await vi.waitFor(() => {
      const items = list(queryClient);
      expect(items).toHaveLength(1);
      expect(items?.[0]).toMatchObject({ id: 'a', name: 'Leche', normalizedName: 'leche' });
      expect(items?.[0]?.boughtBy).toBe('me');
      expect(items?.[0]?.boughtAt).not.toBeNull();
    });
    const mutations = queryClient.getMutationCache().getAll();
    expect(mutations).toHaveLength(2);
    expect(mutations.every((m) => m.state.isPaused)).toBe(true);
    expect(addShoppingItem).not.toHaveBeenCalled();
    expect(setItemBought).not.toHaveBeenCalled();

    vi.mocked(addShoppingItem).mockResolvedValue('a');
    vi.mocked(setItemBought).mockResolvedValue(undefined);
    onlineManager.setOnline(true);
    await queryClient.resumePausedMutations();
    await Promise.all([added, marked]);

    expect(addShoppingItem).toHaveBeenCalledWith('a', 'h', 'Leche', null);
    expect(setItemBought).toHaveBeenCalledWith('a', true);
    expect(vi.mocked(addShoppingItem).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(setItemBought).mock.invocationCallOrder[0] as number,
    );
  });

  it('keeps a single item with the server id when the add merged into another', async () => {
    const { queryClient, add } = setup();
    queryClient.setQueryData(key, []);
    vi.mocked(addShoppingItem).mockResolvedValue('x');
    await add(milk);
    expect(list(queryClient)?.map((i) => i.id)).toEqual(['x']);
  });

  it('drops the optimistic item when the merged item is already cached', async () => {
    const { queryClient, add } = setup();
    queryClient.setQueryData(key, [{ ...existing, name: 'Pan', normalizedName: 'pan' }]);
    vi.mocked(addShoppingItem).mockResolvedValue('x');
    await add(milk);
    expect(list(queryClient)?.map((i) => i.id)).toEqual(['x']);
  });

  it('marks the merged item when a queued bought follows a merged add', async () => {
    const { queryClient, add, bought } = setup();
    queryClient.setQueryData(key, []);
    onlineManager.setOnline(false);
    const added = add(milk);
    const marked = bought({ id: 'a', householdId: 'h', bought: true, userId: 'me' });
    vi.mocked(addShoppingItem).mockResolvedValue('x');
    vi.mocked(setItemBought).mockResolvedValue(undefined);
    onlineManager.setOnline(true);
    await queryClient.resumePausedMutations();
    await Promise.all([added, marked]);
    expect(setItemBought).toHaveBeenCalledWith('x', true);
  });

  it('removes the item and explains when the server rejects the add', async () => {
    const { queryClient, notify, add } = setup();
    queryClient.setQueryData(key, [existing]);
    vi.mocked(addShoppingItem).mockRejectedValue(new AppError('INVALID_ITEM_NAME'));
    await add(milk).catch(() => undefined);
    expect(list(queryClient)).toEqual([existing]);
    expect(notify).toHaveBeenCalledWith('No se pudo guardar «Leche»');
  });

  it('restores the item and explains when the server rejects a bought', async () => {
    const { queryClient, notify, bought } = setup();
    queryClient.setQueryData(key, [existing]);
    vi.mocked(setItemBought).mockRejectedValue(new AppError('ITEM_NOT_FOUND'));
    await bought({ id: 'x', householdId: 'h', bought: true, userId: 'me' }).catch(() => undefined);
    expect(list(queryClient)).toEqual([existing]);
    expect(notify).toHaveBeenCalledWith('No se pudo guardar «Leche»');
  });

  it('retries network errors instead of failing', () => {
    const { defaults } = setup();
    const retry = defaults.add.retry as (count: number, error: AppError) => boolean;
    expect(retry(5, new AppError('NETWORK'))).toBe(true);
    expect(retry(0, new AppError('INVALID_ITEM_NAME'))).toBe(false);
    expect(defaults.bought.retry).toBe(defaults.add.retry);
  });

  it('refreshes the list and history only after the last shopping mutation settles', async () => {
    const { queryClient, add, bought } = setup();
    queryClient.setQueryData(key, []);
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(addShoppingItem).mockResolvedValue('a');
    vi.mocked(setItemBought).mockResolvedValue(undefined);
    await Promise.all([
      add(milk),
      bought({ id: 'a', householdId: 'h', bought: true, userId: 'me' }),
    ]);
    const keys = spy.mock.calls.map((c) => c[0]?.queryKey);
    expect(keys).toEqual([['shopping'], ['shopping-history']]);
  });
});
