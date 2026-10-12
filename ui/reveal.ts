// Pure: no react-native import, so Vitest can check it.

export type RevealInput = {
  /** The focused field's top edge, in window coordinates. */
  fieldTop: number;
  fieldHeight: number;
  /** The scroll view's visible area, in window coordinates. */
  viewportTop: number;
  viewportHeight: number;
  /** The scroll view's current offset. */
  offset: number;
  /** Room to keep between the field and the edge of the visible area. */
  margin: number;
};

/**
 * Where to scroll so the focused field sits fully inside the visible part of its scroll view,
 * with `margin` to spare, or null when it already does. A field too tall to fit shows its top,
 * where the label and the caret start.
 */
export function revealOffset({
  fieldTop,
  fieldHeight,
  viewportTop,
  viewportHeight,
  offset,
  margin,
}: RevealInput): number | null {
  const top = fieldTop - viewportTop;
  const bottom = top + fieldHeight;
  if (top >= margin && bottom <= viewportHeight - margin) return null;
  if (top < margin || fieldHeight + 2 * margin > viewportHeight) {
    return Math.max(0, offset + top - margin);
  }
  return offset + bottom - (viewportHeight - margin);
}
