// Pure: no react-native import, so Vitest can check it.

/**
 * Whether a modal route (a task or product sheet, the templates) is drawn over the tabs. The
 * sheets are transparent modals in the same window, so the tabs stay mounted beneath them and a
 * screen reader would walk on into them unless they are hidden.
 */
export function coveredByModal(segments: readonly string[]): boolean {
  return segments.length > 0 && segments[0] !== '(tabs)';
}
