// Pure: no react-native import, so Vitest can check it.

export type DeferredClear = {
  /** Starts the undo window; a clear already waiting goes through first. */
  start: (ms: number) => void;
  /** Keeps the bag. True when there was a clear to stop. */
  undo: () => boolean;
  /** Clears now if one is waiting (the screen goes away). */
  flush: () => void;
  pending: () => boolean;
};

/**
 * «Vaciar bolsa» with an undo: the bag empties on screen at once and the server is asked only
 * when the undo window ends, so «Deshacer» has nothing to restore.
 */
export function createDeferredClear({
  commit,
  schedule,
}: {
  commit: () => void;
  /** Runs `fn` after `ms`; returns what cancels it. */
  schedule: (fn: () => void, ms: number) => () => void;
}): DeferredClear {
  let cancel: (() => void) | null = null;
  const take = () => {
    const waiting = cancel;
    cancel = null;
    waiting?.();
    return waiting !== null;
  };
  const flush = () => {
    if (take()) commit();
  };
  return {
    start: (ms) => {
      flush();
      cancel = schedule(() => {
        cancel = null;
        commit();
      }, ms);
    },
    undo: take,
    flush,
    pending: () => cancel !== null,
  };
}
