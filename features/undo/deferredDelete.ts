// Pure: no react-native import, so Vitest can check it.
import { toAppError, type AppErrorCode } from '@/data/supabase/errors';
import { t, type MessageKey } from '@/i18n';
import type { NoticeAction } from '@/ui/components/Notice';
import { createDeferred } from './deferred';

export type DeleteArgs = {
  id: string;
  /** Deletes on the server and refreshes the list; rejects when it could not. */
  remove: (id: string) => Promise<void>;
  notify: (message: string, action?: NoticeAction) => void;
  /** How long «Deshacer» stays; null while a screen reader keeps it until the person is done. */
  ms: number | null;
  /** Runs `fn` after `ms`; returns what cancels it. */
  schedule: (fn: () => void, ms: number) => () => void;
  /** Calls `flush` when the app goes to the background; returns what stops watching. */
  watchBackground: (flush: () => void) => () => void;
};

export type HiddenStore = {
  get: () => ReadonlySet<string>;
  subscribe: (listener: () => void) => () => void;
};

/** What a kind of thing says while it is deleted with «Deshacer». */
type Messages = {
  deleted: MessageKey;
  undo: MessageKey;
  tooLate: MessageKey;
  failed: MessageKey;
  failedOffline: MessageKey;
  /** The server's code for one already gone: it counts as deleted. */
  notFound: AppErrorCode;
};

/**
 * A delete without a dialog, for what is reversible in the day to day (a task, a product;
 * DESIGN.md «Destructivo, en su medida»): the thing leaves the lists at once (`hidden`), «…
 * borrada. Deshacer» shows, and the server deletes it only when the notice goes unused, as «Vaciar
 * bolsa» does. A failed delete puts it back and says so; one already gone counts as deleted.
 *
 * Going to the background sends it at once (`watchBackground`), since the system may kill the app
 * there. If it kills the process before the request lands, the thing comes back on the next start:
 * the safe direction (nothing is lost that the person did not see go), and the window is short, 5 s
 * without a screen reader (`noticeTiming`). Nothing is kept on disk to replay it, on purpose: a
 * delete that resurfaced days later from a queue would surprise more than a thing that stayed.
 */
export function createDeferredDelete(messages: Messages) {
  let hidden: ReadonlySet<string> = new Set();
  const listeners = new Set<() => void>();
  const setHidden = (next: ReadonlySet<string>) => {
    hidden = next;
    listeners.forEach((listener) => listener());
  };
  const hide = (id: string) => {
    if (!hidden.has(id)) setHidden(new Set([...hidden, id]));
  };
  const show = (id: string) => {
    if (!hidden.has(id)) return;
    const next = new Set(hidden);
    next.delete(id);
    setHidden(next);
  };
  /** What is deleted on screen and still waits for its «Deshacer» to go: the lists leave it out. */
  const store: HiddenStore = {
    get: () => hidden,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  function deleteWithUndo({ id, remove, notify, ms, schedule, watchBackground }: DeleteArgs): void {
    let stopWatching = () => undefined as void;
    const deferred = createDeferred({
      commit: () => {
        stopWatching();
        remove(id).then(
          () => show(id),
          (error: unknown) => {
            show(id);
            const code = toAppError(error).code;
            if (code === messages.notFound) return;
            notify(t(code === 'NETWORK' ? messages.failedOffline : messages.failed));
          },
        );
      },
      schedule,
    });
    hide(id);
    deferred.start(ms);
    stopWatching = watchBackground(() => deferred.flush());
    notify(t(messages.deleted), {
      label: t(messages.undo),
      testID: 'notice.undo',
      // It is gone from the list: nothing to uncover, the list does not move.
      leftList: true,
      onPress: () => {
        // Already sent (the app went to the background, or the window just ended): say so rather
        // than pretend it came back.
        if (!deferred.undo()) {
          notify(t(messages.tooLate));
          return;
        }
        stopWatching();
        show(id);
      },
      onExpire: () => deferred.flush(),
    });
  }

  return { hidden: store, show, deleteWithUndo };
}
