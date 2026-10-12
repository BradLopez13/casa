/** What the list area shows: a load error with nothing cached, loading, an empty list, or rows. */
export type ShoppingState = 'error' | 'loading' | 'empty' | 'list';

/** The same choice for one column and two panes; an error only wins while nothing is cached. */
export function shoppingState({
  loaded,
  failed,
  itemCount,
}: {
  loaded: boolean;
  failed: boolean;
  itemCount: number;
}): ShoppingState {
  if (!loaded) return failed ? 'error' : 'loading';
  return itemCount === 0 ? 'empty' : 'list';
}

export type ShoppingPanes = {
  /** Error, loading or empty: said on the left, under the field. Null once there are rows. */
  leftState: Exclude<ShoppingState, 'list'> | null;
  /** The sheet of what is still to buy, on the left. */
  pendingSheet: boolean;
  /** The sheet of "Compradas" with "Limpiar compradas", on the right. */
  boughtSheet: boolean;
  /** A line saying nothing is bought yet, on the right, when the list has no bought rows. */
  boughtEmpty: boolean;
};

/**
 * Compra on two panes: the field (with its suggestions) and what is left to buy on the left, the
 * bought ones on the right. A sheet with no rows is not drawn at all, so a pane never shows an
 * empty white card.
 */
export function shoppingPanes(
  state: ShoppingState,
  pendingCount: number,
  boughtCount: number,
): ShoppingPanes {
  const list = state === 'list';
  return {
    leftState: list ? null : state,
    pendingSheet: list && pendingCount > 0,
    boughtSheet: list && boughtCount > 0,
    boughtEmpty: (list || state === 'empty') && boughtCount === 0,
  };
}

/** Space step above the list: the offline band already sits there, so it closes up. */
export function listTopStep(online: boolean): number {
  return online ? 6 : 2;
}
