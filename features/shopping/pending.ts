import type { QueryClient } from '@tanstack/react-query';
import {
  applyAdd,
  applyBought,
  applyQuantity,
  findPending,
  type ShoppingItem,
} from '@/domain/shopping/list';
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

type ShoppingMutation = ReturnType<ReturnType<QueryClient['getMutationCache']>['getAll']>[number];

/** The shopping changes still queued, oldest first: take them before a fetch begins. */
export function pendingShopping(queryClient: QueryClient): ShoppingMutation[] {
  return queryClient
    .getMutationCache()
    .findAll({ mutationKey: ['shopping'], status: 'pending' })
    .sort((a, b) => a.mutationId - b.mutationId);
}

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
  /**
   * What was queued when the fetch began (`pendingShopping`): a change that reached the server
   * while the list was being read is not in that list, and no longer pending either. Those that
   * failed meanwhile are left out: their rollback already ran.
   */
  earlier: readonly ShoppingMutation[] = [],
): ShoppingItem[] {
  const resolved = queryClient.getQueryData<Readonly<Record<string, string>>>(
    resolvedKey(householdId),
  );
  // A queued add whose name is already a pending row (another member's) will merge into that row
  // on the server: what is queued behind it lands there in the meantime too.
  const alias = new Map<string, string>();
  const resolve = (id: string) => alias.get(id) ?? resolved?.[id] ?? id;
  const byId = new Map<number, ShoppingMutation>();
  for (const mutation of earlier) {
    if (mutation.state.status !== 'error') byId.set(mutation.mutationId, mutation);
  }
  for (const mutation of pendingShopping(queryClient)) byId.set(mutation.mutationId, mutation);
  const queued = [...byId.values()].sort((a, b) => a.mutationId - b.mutationId);
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
      const sameName = findPending(out, add.name);
      if (sameName) {
        alias.set(add.id, sameName.id);
        continue;
      }
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
