// Pure: no react-native import, so Vitest can check it.
import { toAppError } from '@/data/supabase/errors';

export type ErrorReport = {
  key: string;
  code: string;
  status: number | undefined;
  serverCode: string | undefined;
  queued: boolean;
};

/**
 * What Sentry gets for a failed query or mutation (bloque 13, T-2), or null when it is not worth
 * reporting: an answer the app does not know (`UNKNOWN`: an RPC broken by a migration, a 5xx) and
 * any queued change the queue dropped, whose note was undone on someone's phone. Only the key's
 * leading words, the codes and the status: never variables, which carry product and task names.
 * A connection that failed, or a queue let go on signing out, is not a fault.
 */
export function errorReport(
  error: unknown,
  where: { key: readonly unknown[] | undefined; queued: boolean },
): ErrorReport | null {
  const appError = toAppError(error);
  if (appError.code === 'NETWORK' || appError.code === 'NOT_AUTHENTICATED') return null;
  if (appError.code !== 'UNKNOWN' && !where.queued) return null;
  const words = (where.key ?? []).filter((part): part is string => typeof part === 'string');
  // A household or task id after the feature's name says nothing useful and is left out.
  const key = words.filter((word) => !/^[0-9a-f-]{8,}$/i.test(word) && word.length < 40);
  return {
    key: (where.queued ? key.slice(0, 2) : key.slice(0, 1)).join('/'),
    code: appError.code,
    status: appError.status,
    serverCode: appError.serverCode,
    queued: where.queued,
  };
}
