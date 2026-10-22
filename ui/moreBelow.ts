// Pure: no react-native import, so Vitest can check it.

/** Less than this left to scroll counts as the end: a rounding pixel is not «more below». */
const SLACK = 8;

/**
 * Whether a scroll still hides something under its bottom edge: the task sheet on a phone on its
 * side cut its fourth magnet under the foot with nothing saying there was more (fase 10c).
 */
export function hasMoreBelow(contentHeight: number, offset: number, viewport: number): boolean {
  if (viewport <= 0) return false;
  return contentHeight - offset - viewport > SLACK;
}
