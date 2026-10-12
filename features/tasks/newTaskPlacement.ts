// Where the floating "Nueva tarea" pill sits, and how much room the list under it leaves.
// Pure: the caller passes the safe-area insets and its spacing values.

export type NewTaskPlacement = { right: number; bottom: number };

/**
 * With the bottom tab bar, the bar already clears the bottom safe area, so only the side inset
 * (a notch in landscape) is added. With the rail there is no bar below the screen: the pill also
 * clears the home indicator.
 */
export function newTaskPlacement({
  insets,
  rail,
  edge,
}: {
  insets: { right: number; bottom: number };
  rail: boolean;
  edge: number;
}): NewTaskPlacement {
  return {
    right: edge + insets.right,
    bottom: edge + (rail ? insets.bottom : 0),
  };
}

/** Bottom padding for the list, so its last item can scroll clear above the pill. */
export function newTaskListPadding({
  placement,
  buttonHeight,
  clearance,
}: {
  placement: NewTaskPlacement;
  buttonHeight: number;
  clearance: number;
}): number {
  return placement.bottom + buttonHeight + clearance;
}

/** Size of the round, icon-only button on a short window: Material's FAB, above the 44 minimum. */
export const ROUND_NEW_TASK = 56;

export type NewTaskShape = { iconOnly: boolean; height: number };

/**
 * On a short window (a phone on its side) the list shows about one note, and the extended pill
 * with its label would cover it: there the button is a round "+" of 56 dp, still named "Nueva
 * tarea" for screen readers. Anywhere else it keeps the labelled pill.
 */
export function newTaskShape({
  shortHeight,
  pillHeight,
}: {
  shortHeight: boolean;
  pillHeight: number;
}): NewTaskShape {
  return shortHeight
    ? { iconOnly: true, height: ROUND_NEW_TASK }
    : { iconOnly: false, height: pillHeight };
}
