// Pure: no react-native import, so Vitest can check it.

/**
 * The size of an icon that sits beside a label, in dp: it grows with the system text size as
 * the label does, so it never looks shrunk next to large text. It never drops below `base`.
 */
export function glyphSize(base: number, fontScale: number): number {
  return Math.round(base * Math.max(1, fontScale));
}
