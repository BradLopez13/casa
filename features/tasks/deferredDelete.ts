// Pure: no react-native import, so Vitest can check it.
import { createDeferredDelete } from '@/features/undo/deferredDelete';

/** «Borrar tarea» without a dialog, with «Tarea borrada. Deshacer» (`createDeferredDelete`). */
const tasks = createDeferredDelete({
  deleted: 'tasks.deleted',
  undo: 'tasks.undo',
  tooLate: 'tasks.deleteTooLate',
  failed: 'tasks.deleteFailed',
  failedOffline: 'tasks.deleteFailedOffline',
  notFound: 'TASK_NOT_FOUND',
});

/**
 * The tasks deleted on screen whose delete still waits for its «Deshacer» to go: the lists leave
 * them out even if a refetch (realtime, the tirador) brings them back meanwhile.
 */
export const hiddenTasks = tasks.hidden;
export const showTask = tasks.show;
export const deleteWithUndo = tasks.deleteWithUndo;
