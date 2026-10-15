// Pure: no react-native import, so Vitest can check it.

/** Measured widths in a modal's Cancel | title | Save bar, in dp. 0 means not laid out yet. */
export type ModalHeaderWidths = {
  /** The bar's width inside its padding. */
  row: number;
  gap: number;
  cancel: number;
  save: number;
  /** The title's width on one line, unconstrained. */
  title: number;
};

/**
 * Whether the title fits on one line between the two actions. The title is centred, so each side
 * reserves the wider of the two. When it does not fit (large system text on a phone), the bar
 * keeps the actions on their row and the title moves to a line of its own under them, whole,
 * rather than being cut to "Nueva ta…". Until every piece is measured the bar stays inline, as
 * it is at the default text size.
 */
export function modalTitleInline({ row, gap, cancel, save, title }: ModalHeaderWidths): boolean {
  if (row <= 0 || cancel <= 0 || save <= 0 || title <= 0) return true;
  return title + 2 * Math.max(cancel, save) + 2 * gap <= row;
}
