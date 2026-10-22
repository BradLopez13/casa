// Pure: no react-native import, so Vitest can check it.
import { toAppError } from '@/data/supabase/errors';
import { createDeferred } from '@/features/undo/deferred';
import { t } from '@/i18n';
import type { NoticeAction } from '@/ui/components/Notice';

let hidden: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function setHidden(next: ReadonlySet<string>) {
  hidden = next;
  listeners.forEach((listener) => listener());
}

/**
 * The tasks deleted on screen whose delete still waits for its «Deshacer» to go: the lists leave
 * them out even if a refetch (realtime, the tirador) brings them back meanwhile.
 */
export const hiddenTasks = {
  get: (): ReadonlySet<string> => hidden,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

function hideTask(id: string) {
  if (!hidden.has(id)) setHidden(new Set([...hidden, id]));
}

export function showTask(id: string) {
  if (!hidden.has(id)) return;
  const next = new Set(hidden);
  next.delete(id);
  setHidden(next);
}

type Args = {
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

/**
 * «Borrar tarea» without a dialog: the task leaves the lists at once, «Tarea borrada. Deshacer»
 * shows, and the server deletes it only when the notice goes unused, as «Vaciar bolsa» does. A
 * failed delete puts the task back and says so; one already gone counts as deleted.
 *
 * Going to the background sends it at once (`watchBackground`), since the system may kill the app
 * there. If it kills the process before the request lands, the task comes back on the next start:
 * the safe direction (nothing is lost that the person did not see go), and the window is short,
 * 5 s without a screen reader (`noticeTiming`). Nothing is kept on disk to replay it, on purpose:
 * a delete that resurfaced days later from a queue would surprise more than a task that stayed.
 */
export function deleteWithUndo({ id, remove, notify, ms, schedule, watchBackground }: Args): void {
  let stopWatching = () => undefined as void;
  const deferred = createDeferred({
    commit: () => {
      stopWatching();
      remove(id).then(
        () => showTask(id),
        (error: unknown) => {
          showTask(id);
          const code = toAppError(error).code;
          if (code === 'TASK_NOT_FOUND') return;
          notify(t(code === 'NETWORK' ? 'tasks.deleteFailedOffline' : 'tasks.deleteFailed'));
        },
      );
    },
    schedule,
  });
  hideTask(id);
  deferred.start(ms);
  stopWatching = watchBackground(() => deferred.flush());
  notify(t('tasks.deleted'), {
    label: t('tasks.undo'),
    testID: 'notice.undo',
    onPress: () => {
      // Already sent (the app went to the background, or the window just ended): say so rather
      // than pretend it came back.
      if (!deferred.undo()) {
        notify(t('tasks.deleteTooLate'));
        return;
      }
      stopWatching();
      showTask(id);
    },
    onExpire: () => deferred.flush(),
  });
}
