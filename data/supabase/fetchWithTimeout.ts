// Pure: no react-native import, so Vitest can check it.

/** How long a request to Supabase may go unanswered before it counts as no connection. */
export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Deleting the account removes a lot and may take longer, but not for ever: with a dead connection
 * the screen used to stay on «borrando» (fase 10e).
 */
export const DELETE_ACCOUNT_TIMEOUT_MS = 90_000;

const DELETE_ACCOUNT = /\/rpc\/delete_account\b/;

function timeoutError(): Error {
  return Object.assign(new Error('signal timed out'), { name: 'TimeoutError' });
}

/**
 * `fetch` with a time limit: a request with no answer after `REQUEST_TIMEOUT_MS` is aborted with a
 * TimeoutError, which `toAppError` reads as NETWORK, so a weak signal says «Sin conexión» instead
 * of spinning for ever. Built by hand: Hermes has neither `AbortSignal.timeout` nor `.any`. The
 * caller's own signal still aborts it.
 */
export function withTimeout(base: typeof fetch, ms = REQUEST_TIMEOUT_MS): typeof fetch {
  return (input, init) => {
    // Deleting the account may take longer and must not be reported as failed while it goes on.
    const url = String(input instanceof Request ? input.url : input);
    const limit = DELETE_ACCOUNT.test(url) ? DELETE_ACCOUNT_TIMEOUT_MS : ms;
    const controller = new AbortController();
    const own = init?.signal;
    const follow = () => controller.abort(own?.reason);
    if (own?.aborted) follow();
    else own?.addEventListener('abort', follow);
    const timer = setTimeout(() => controller.abort(timeoutError()), limit);
    return base(input, { ...init, signal: controller.signal }).finally(() => {
      clearTimeout(timer);
      own?.removeEventListener('abort', follow);
    });
  };
}
