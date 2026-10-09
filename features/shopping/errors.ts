import { toAppError } from '@/data/supabase/errors';
import { t, type MessageKey } from '@/i18n';

const ERROR_KEYS: Readonly<Record<string, MessageKey>> = {
  INVALID_ITEM_NAME: 'shopping.errors.INVALID_ITEM_NAME',
  INVALID_QUANTITY: 'shopping.errors.INVALID_QUANTITY',
  ITEM_NOT_FOUND: 'shopping.errors.ITEM_NOT_FOUND',
  ITEM_ALREADY_LISTED: 'shopping.errors.ITEM_ALREADY_LISTED',
  NOT_A_MEMBER: 'shopping.errors.NOT_A_MEMBER',
  NETWORK: 'shopping.errors.NETWORK',
};

export function shoppingErrorMessage(error: unknown): string {
  return t(ERROR_KEYS[toAppError(error).code] ?? 'shopping.errors.UNKNOWN');
}
