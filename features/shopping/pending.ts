import type { QueryClient } from '@tanstack/react-query';
import { applyAdd, applyBought, applyQuantity, type ShoppingItem } from '@/domain/shopping/list';
import {
  addKey,
  boughtKey,
  draftShoppingItem,
  quantityKey,
  resolvedKey,
  type AddVars,
  type BoughtVars,
  type QuantityVars,
} from './offline';

/**
 * The household's list as the server sent it, with what is still queued here laid on top, in
 * the order it was done: a product added offline stays, a product marked offline stays in the
 * bag, a quantity changed offline keeps its value. Without it, a refetch while the queue waits
 * (the connection coming back, the tirador, another member's change) showed the list as if
 * nothing had been done until the queue emptied, as the tasks did before (fase 10e).
 */
export function withQueuedShopping(
  queryClient: QueryClient,
  householdId: string,
  items: ShoppingItem[],
): ShoppingItem[] {
  const resolved = queryClient.getQueryData<Readonly<Record<string, string>>>(
    resolvedKey(householdId),
  );
  const resolve = (id: string) => resolved?.[id] ?? id;
  const queued = queryClient
    .getMutationCache()
    .findAll({ mutationKey: ['shopping'], status: 'pending' })
    .sort((a, b) => a.mutationId - b.mutationId);
  let out = items;
  for (const mutation of queued) {
    const kind = mutation.options.mutationKey?.[1];
    const at = new Date(mutation.state.submittedAt || Date.now());
    const vars = mutation.state.variables as { householdId?: string } | undefined;
    if (!vars || vars.householdId !== householdId) continue;
    if (kind === addKey[1]) {
      const add = vars as AddVars;
      // Already there by id, or by name as a pending row (`applyAdd` keeps one per name).
      if (out.some((item) => item.id === resolve(add.id))) continue;
      out = applyAdd(out, draftShoppingItem(add, at));
    } else if (kind === boughtKey[1]) {
      const bought = vars as BoughtVars;
      const target = resolve(bought.id);
      const item = out.find((i) => i.id === target);
      if (!item || (item.boughtAt !== null) === bought.bought) continue;
      out = applyBought(out, target, bought.bought, bought.userId, at.toISOString());
    } else if (kind === quantityKey[1]) {
      const change = vars as QuantityVars;
      const target = resolve(change.id);
      const item = out.find((i) => i.id === target);
      if (!item || item.quantity === change.quantity) continue;
      out = applyQuantity(out, target, change.quantity);
    }
  }
  return out;
}
