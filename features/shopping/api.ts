import * as Crypto from 'expo-crypto';
import { supabase } from '@/data/supabase/client';
import { AppError, toAppError } from '@/data/supabase/errors';
import type { ShoppingItem } from '@/domain/shopping/list';
import { normalizeItemName } from '@/domain/shopping/normalize';
import type { HistoryEntry } from '@/domain/shopping/suggest';

type Result<D> = PromiseLike<{ data: D; error: unknown }>;

/** Resolves with the data (possibly null), or throws an AppError. */
async function unwrapMaybe<D>(promise: Result<D>): Promise<D> {
  let result;
  try {
    result = await promise;
  } catch (e) {
    throw toAppError(e);
  }
  if (result.error) throw toAppError(result.error);
  return result.data;
}

/** Like unwrapMaybe, but a null result is an error. */
async function unwrap<D>(promise: Result<D>): Promise<NonNullable<D>> {
  const data = await unwrapMaybe(promise);
  if (data === null || data === undefined) throw new AppError('UNKNOWN');
  return data;
}

export const newShoppingItemId = (): string => Crypto.randomUUID();

// The generated RPC types declare nullable args as plain string; the functions accept null.
const nullable = (value: string | null) => value as string;

// Postgres returns variable fractional digits; normalise so they compare as instants.
const toIso = (value: string) => new Date(value).toISOString();
const toIsoOrNull = (value: string | null) => (value === null ? null : toIso(value));

/** The items on the list: everything not yet cleared. */
export async function listShoppingItems(householdId: string): Promise<ShoppingItem[]> {
  const data = await unwrap(
    supabase
      .from('shopping_items')
      .select('id, name, normalized_name, quantity, created_at, created_by, bought_at, bought_by')
      .eq('household_id', householdId)
      .is('cleared_at', null),
  );
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    normalizedName: row.normalized_name ?? normalizeItemName(row.name),
    quantity: row.quantity,
    createdAt: toIso(row.created_at),
    createdBy: row.created_by,
    boughtAt: toIsoOrNull(row.bought_at),
    boughtBy: row.bought_by,
  }));
}

export async function shoppingHistory(householdId: string): Promise<HistoryEntry[]> {
  const data = await unwrap(supabase.rpc('shopping_history', { p_household_id: householdId }));
  return data.map((row) => ({
    name: row.name,
    normalizedName: row.normalized_name,
    uses: row.uses,
    lastUsedAt: toIso(row.last_used_at),
  }));
}

/** Resolves with the id of the item on the list, which differs from `id` if it was already there. */
export async function addShoppingItem(
  id: string,
  householdId: string,
  name: string,
  quantity: string | null,
): Promise<string> {
  return unwrap(
    supabase.rpc('add_shopping_item', {
      p_id: id,
      p_household_id: householdId,
      p_name: name,
      p_quantity: nullable(quantity),
    }),
  );
}

export async function setItemBought(id: string, bought: boolean): Promise<void> {
  await unwrapMaybe(supabase.rpc('set_item_bought', { p_id: id, p_bought: bought }));
}

export async function updateShoppingItem(
  id: string,
  name: string,
  quantity: string | null,
): Promise<void> {
  await unwrapMaybe(
    supabase.rpc('update_shopping_item', {
      p_id: id,
      p_name: name,
      p_quantity: nullable(quantity),
    }),
  );
}

export async function deleteShoppingItem(id: string): Promise<void> {
  await unwrapMaybe(supabase.rpc('delete_shopping_item', { p_id: id }));
}

export async function clearBoughtItems(householdId: string): Promise<void> {
  await unwrapMaybe(supabase.rpc('clear_bought_items', { p_household_id: householdId }));
}
