// Pure: no react-native import, so Vitest can check it.
import { createDeferredDelete } from '@/features/undo/deferredDelete';

/**
 * «Borrar producto» without a dialog, as a task (decisión 2 de Brad, 27 de octubre): a product
 * touches nobody but the list, so it leaves at once with «Producto borrado. Deshacer» and the
 * server deletes it when the notice goes (`createDeferredDelete`).
 */
const products = createDeferredDelete({
  deleted: 'shopping.deleted',
  undo: 'tasks.undo',
  tooLate: 'shopping.deleteTooLate',
  failed: 'shopping.deleteFailed',
  failedOffline: 'shopping.deleteFailedOffline',
  notFound: 'ITEM_NOT_FOUND',
});

/** The products deleted on screen whose «Deshacer» is still up: the list leaves them out. */
export const hiddenItems = products.hidden;
export const showItem = products.show;
export const deleteItemWithUndo = products.deleteWithUndo;
