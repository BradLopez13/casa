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
      if (!deferred.undo()) return;
      stopWatching();
      showTask(id);
    },
    onExpire: () => deferred.flush(),
  });
}
