// Pure: no react-native import, so Vitest can check it.
import type { Layout } from './layout';

/** How a modal (new or edit task, edit item, templates) is drawn. */
export type ModalFrame = 'full' | 'sheet';

/** The sheet never takes more than this share of the window's height. */
export const SHEET_MAX_HEIGHT = 0.9;

export type Insets = { top: number; right: number; bottom: number; left: number };

/** A phone in portrait gets the whole screen, as before; anything wider gets a centred sheet. */
export function modalFrameFor(layout: Pick<Layout, 'size'>): ModalFrame {
  return layout.size === 'compact' ? 'full' : 'sheet';
}

/** Below this height the window is short (a phone on its side): the sheet runs its full height. */
const SHORT_WINDOW = 500;

/**
 * The space kept around the sheet. Above and below, 5 % of the window each, so the sheet stays
 * within 90 % of its height; at the sides, the class gutter. A notch or a system bar that is
 * deeper than that pushes the sheet further in. On a short window there is no 5 %: the sheet runs
 * from the status bar to the bottom bar, as every dp there is a line of the form (bloque 11).
 */
export function sheetMargins(windowHeight: number, gutter: number, insets: Insets): Insets {
  const vertical =
    windowHeight < SHORT_WINDOW ? 0 : Math.round((windowHeight * (1 - SHEET_MAX_HEIGHT)) / 2);
  return {
    top: Math.max(vertical, insets.top),
    right: Math.max(gutter, insets.right),
    bottom: Math.max(vertical, insets.bottom),
    left: Math.max(gutter, insets.left),
  };
}

/** Spacing of a modal form, in `space()` steps, and whether a new task's title takes focus. */
export type FormDensity = {
  /** Above and below the Cancel | title | Save bar. */
  headerStep: number;
  /** Above the first field. */
  topStep: number;
  /** Between fields. */
  gapStep: number;
  /** Under the last field. */
  bottomStep: number;
  autoFocusTitle: boolean;
  /** The foot's actions and Save share one row, so the sheet keeps its height for the fields. */
  footRow: boolean;
  /**
   * The title and the properties side by side (2) or one under the other (1). On a short window
   * even the full-height sheet left about 200 dp for the form: in one column, a title and one
   * property (bloque 11).
   */
  columns: 1 | 2;
};

/**
 * On a short window (a phone on its side) the sheet would show only the title and one section,
 * and the keyboard would cover the rest: there the form closes up and the title waits for a tap
 * before the keyboard comes up. Everywhere else the form keeps its spacing and its autofocus.
 */
export function formDensity(layout: Pick<Layout, 'shortHeight' | 'landscape'>): FormDensity {
  return layout.shortHeight
    ? {
        headerStep: 1,
        topStep: 3,
        gapStep: 4,
        bottomStep: 5,
        autoFocusTitle: false,
        footRow: true,
        // Side by side only on a phone on its side: a short narrow window (split screen) has no
        // room for two.
        columns: layout.landscape ? 2 : 1,
      }
    : {
        headerStep: 2,
        topStep: 5,
        gapStep: 6,
        bottomStep: 8,
        autoFocusTitle: true,
        footRow: false,
        columns: 1,
      };
}
