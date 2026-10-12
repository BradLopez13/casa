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

/**
 * The space kept around the sheet. Above and below, 5 % of the window each, so the sheet stays
 * within 90 % of its height; at the sides, the class gutter. A notch or a system bar that is
 * deeper than that pushes the sheet further in.
 */
export function sheetMargins(windowHeight: number, gutter: number, insets: Insets): Insets {
  const vertical = Math.round((windowHeight * (1 - SHEET_MAX_HEIGHT)) / 2);
  return {
    top: Math.max(vertical, insets.top),
    right: Math.max(gutter, insets.right),
    bottom: Math.max(vertical, insets.bottom),
    left: Math.max(gutter, insets.left),
  };
}
