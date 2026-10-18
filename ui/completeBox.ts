import type { Palette } from './tokens';

/**
 * Pure: how the box that completes a task is drawn. Open: an empty box with a solid edge (a
 * dashed edge means «paused», never «not done»). Done: the pósit with the check.
 */
export function completeBoxLook(
  checked: boolean,
  colors: Pick<Palette, 'selection' | 'accent' | 'accentEdge' | 'onAccent'>,
): { fill: string; border: string; check: string | null } {
  if (checked) return { fill: colors.accent, border: colors.accentEdge, check: colors.onAccent };
  return { fill: 'transparent', border: colors.selection, check: null };
}
