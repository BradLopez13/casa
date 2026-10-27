import { AppError, toAppError } from './errors';

type Result<D> = PromiseLike<{ data: D; error: unknown; status?: number }>;

/**
 * Resolves with the data (possibly null), or throws an AppError that keeps the answer's HTTP
 * status and the server's code (`isTransient` and Sentry read them; bloque 13).
 */
export async function unwrapMaybe<D>(promise: Result<D>): Promise<D> {
  let result;
  try {
    result = await promise;
  } catch (e) {
    throw toAppError(e);
  }
  if (result.error) throw toAppError(result.error, result.status);
  return result.data;
}

/** Like unwrapMaybe, but a null result is an error. */
export async function unwrap<D>(promise: Result<D>): Promise<NonNullable<D>> {
  const data = await unwrapMaybe(promise);
  if (data === null || data === undefined) throw new AppError('UNKNOWN');
  return data;
}
