import type { Palette } from './tokens';

export type MagnetCheck = 'faint' | 'filled';

/** Pure: how the check on a magnet is drawn. `faint` is a glyph tint (40 %), not a disabled state. */
export function magnetCheckStyle(
  check: MagnetCheck,
  colors: Pick<Palette, 'muted' | 'accent' | 'onAccent'>,
): { tint: string; opacity: number; fill: string | null } {
  return check === 'filled'
    ? { tint: colors.onAccent, opacity: 1, fill: colors.accent }
    : { tint: colors.muted, opacity: 0.4, fill: null };
}
