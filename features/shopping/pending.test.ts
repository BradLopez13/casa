import { MutationObserver, onlineManager, QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppError } from '@/data/supabase/errors';
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
import { withQueuedShopping } from './pending';

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
});
