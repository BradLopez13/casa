import { MutationObserver, onlineManager, QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError as AppErrorClass, type AppError } from '@/data/supabase/errors';
import type { ShoppingItem } from '@/domain/shopping/list';
import {
  addKey,
  boughtKey,
  buildShoppingMutationDefaults,
  quantityKey,
  type AddVars,
  type BoughtVars,
  type QuantityVars,
} from './offline';
import { addShoppingItem } from './api';
import { pendingShopping, withQueuedShopping } from './pending';

vi.mock('./api', () => ({
  addShoppingItem: vi.fn(),
  setItemBought: vi.fn(),
  updateShoppingItem: vi.fn(),
}));

const bread: ShoppingItem = {
  id: 'p',
  name: 'Pan',
  normalizedName: 'pan',
  quantity: null,
  createdAt: '2026-10-22T08:00:00.000Z',
  createdBy: 'me',
  boughtAt: null,
  boughtBy: null,
};
const milk: AddVars = { id: 'a', householdId: 'h', name: 'Leche', quantity: null, userId: 'me' };

/** A client offline with an add, a bought and a quantity change waiting in the queue. */
function queued() {
  const queryClient = new QueryClient();
  queryClient.mount();
  const defaults = buildShoppingMutationDefaults(queryClient, vi.fn());
  queryClient.setMutationDefaults(addKey, defaults.add);
  queryClient.setMutationDefaults(boughtKey, defaults.bought);
  queryClient.setMutationDefaults(quantityKey, defaults.quantity);
  onlineManager.setOnline(false);
  queryClient.setQueryData<ShoppingItem[]>(['shopping', 'h'], [bread]);
  const run = <V>(mutationKey: string[], vars: V) =>
    void new MutationObserver<unknown, AppError, V>(queryClient, { mutationKey })
      .mutate(vars)
      .catch(() => undefined);
  run<AddVars>(addKey, milk);
  run<BoughtVars>(boughtKey, { id: 'p', householdId: 'h', bought: true, userId: 'me' });
  run<QuantityVars>(quantityKey, { id: 'a', householdId: 'h', name: 'Leche', quantity: '2' });
  return queryClient;
}

afterEach(() => {
  onlineManager.setOnline(true);
});

describe('withQueuedShopping (fase 10e)', () => {
  it('keeps what is queued on top of a list from the server that does not have it yet', async () => {
    const queryClient = queued();
    await vi.waitFor(() => expect(queryClient.isMutating()).toBe(3));
    const shown = withQueuedShopping(queryClient, 'h', [bread]);
    expect(shown.map((i) => i.name)).toEqual(['Pan', 'Leche']);
    expect(shown.find((i) => i.id === 'p')?.boughtBy).toBe('me');
    expect(shown.find((i) => i.id === 'a')?.quantity).toBe('2');
  });

  it('leaves a list that already has them as it is', async () => {
    const queryClient = queued();
    await vi.waitFor(() => expect(queryClient.isMutating()).toBe(3));
    const fromServer: ShoppingItem[] = [
      { ...bread, boughtAt: '2026-10-22T09:00:00.000Z', boughtBy: 'me' },
      { ...bread, id: 'a', name: 'Leche', normalizedName: 'leche', quantity: '2' },
    ];
    expect(withQueuedShopping(queryClient, 'h', fromServer)).toEqual(fromServer);
  });

  it('only touches the household the queue is for', async () => {
    const queryClient = queued();
    await vi.waitFor(() => expect(queryClient.isMutating()).toBe(3));
    const other = [{ ...bread, id: 'x' }];
    expect(withQueuedShopping(queryClient, 'other', other)).toBe(other);
  });

  it('lands a queued change on the row another member already added with the same name', async () => {
    const queryClient = queued();
    await vi.waitFor(() => expect(queryClient.isMutating()).toBe(3));
    // Someone else's «Leche» is on the server already: the queued add will merge into it.
    const theirs: ShoppingItem = {
      ...bread,
      id: 'b',
      name: 'Leche',
      normalizedName: 'leche',
      createdBy: 'other',
    };
    const shown = withQueuedShopping(queryClient, 'h', [bread, theirs]);
    expect(shown.map((i) => i.id)).toEqual(['p', 'b']);
    // The quantity queued on our «Leche» shows on theirs.
    expect(shown.find((i) => i.id === 'b')?.quantity).toBe('2');
  });

  describe('a change that ends while the list is being fetched', () => {
    function oneAdd(result: 'ok' | 'fail') {
      const queryClient = new QueryClient();
      queryClient.mount();
      const defaults = buildShoppingMutationDefaults(queryClient, vi.fn());
      queryClient.setMutationDefaults(addKey, { ...defaults.add, retry: false });
      vi.mocked(addShoppingItem).mockImplementation(() =>
        result === 'ok' ? Promise.resolve('a') : Promise.reject(new AppErrorClass('UNKNOWN')),
      );
      queryClient.setQueryData<ShoppingItem[]>(['shopping', 'h'], [bread]);
      onlineManager.setOnline(false);
      void new MutationObserver<string, AppError, AddVars>(queryClient, { mutationKey: addKey })
        .mutate(milk)
        .catch(() => undefined);
      return queryClient;
    }

    it('still shows an add that reached the server after the list was read', async () => {
      const queryClient = oneAdd('ok');
      await vi.waitFor(() => expect(queryClient.isMutating()).toBe(1));
      // The fetch starts with the add still queued...
      const before = pendingShopping(queryClient);
      // ...and the add lands while it runs: the list read before it has no «Leche».
      onlineManager.setOnline(true);
      await vi.waitFor(() => expect(queryClient.isMutating()).toBe(0));
      const shown = withQueuedShopping(queryClient, 'h', [bread], before);
      expect(shown.map((i) => i.name)).toEqual(['Pan', 'Leche']);
    });

    it('does not bring back an add that failed meanwhile', async () => {
      const queryClient = oneAdd('fail');
      await vi.waitFor(() => expect(queryClient.isMutating()).toBe(1));
      const before = pendingShopping(queryClient);
      onlineManager.setOnline(true);
      await vi.waitFor(() => expect(queryClient.isMutating()).toBe(0));
      expect(withQueuedShopping(queryClient, 'h', [bread], before).map((i) => i.name)).toEqual([
        'Pan',
      ]);
    });
  });
});
