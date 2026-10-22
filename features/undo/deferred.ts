// Pure: no react-native import, so Vitest can check it.

export type Deferred = {
  /** Starts the undo window; an action already waiting goes through first. null: no timer, the
   * action waits for `flush` (a screen reader keeps «Deshacer» until the person is done). */
  start: (ms: number | null) => void;
  /** Keeps things as they were. True when there was an action to stop. */
  undo: () => boolean;
  /** Runs now if one is waiting (the screen goes away). */
  flush: () => void;
  pending: () => boolean;
};

/**
 * An action with an undo («Vaciar bolsa», «Borrar tarea»): it happens on screen at once and the
 * server is asked only when the undo window ends, so «Deshacer» has nothing to restore.
 */
export function createDeferred({
  commit,
  schedule,
}: {
  commit: () => void;
  /** Runs `fn` after `ms`; returns what cancels it. */
  schedule: (fn: () => void, ms: number) => () => void;
}): Deferred {
  let cancel: (() => void) | null = null;
  const nothing = () => undefined;
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
      cancel =
        ms === null
          ? nothing
          : schedule(() => {
              cancel = null;
              commit();
            }, ms);
    },
    undo: take,
    flush,
    pending: () => cancel !== null,
  };
}
