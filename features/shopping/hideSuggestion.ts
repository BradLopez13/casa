// Pure: no react-native import, so Vitest can check it.
import { createDeferredDelete } from '@/features/undo/deferredDelete';

/**
 * Dropping a name from «¿Falta algo de lo de siempre?» (bloque 15.3, P3-9): the suggestion leaves
 * at once with «Quitada de lo de siempre. Deshacer», and the server hides it for the household
 * when the notice goes unused, as a product is deleted (`createDeferredDelete`). The id is the
 * normalized name, which is how the history groups it. Listing the name again shows it again.
 */
const suggestions = createDeferredDelete({
  deleted: 'shopping.usualRemoved',
  undo: 'tasks.undo',
  tooLate: 'shopping.usualRemoveTooLate',
  failed: 'shopping.usualRemoveFailed',
  failedOffline: 'shopping.usualRemoveFailedOffline',
  notFound: 'ITEM_NOT_FOUND',
});

/** The normalized names dropped on screen whose «Deshacer» is still up: the list leaves them out. */
export const hiddenSuggestions = suggestions.hidden;
export const hideSuggestionWithUndo = suggestions.deleteWithUndo;
