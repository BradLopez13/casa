import type { Palette, Scheme } from './tokens';

export type MagnetCheck = 'faint' | 'filled';

/**
 * Pure: how the check on a magnet is drawn. `faint` is a glyph tint, not a disabled state: muted
 * at 40 % in light, ink at 70 % in dark, where a muted 40 % sinks into the slate.
 */
export function magnetCheckStyle(
  check: MagnetCheck,
  colors: Pick<Palette, 'ink' | 'muted' | 'accent' | 'onAccent'>,
  scheme: Scheme,
): { tint: string; opacity: number; fill: string | null } {
  if (check === 'filled') return { tint: colors.onAccent, opacity: 1, fill: colors.accent };
  const dark = scheme === 'dark';
  return { tint: dark ? colors.ink : colors.muted, opacity: dark ? 0.7 : 0.4, fill: null };
}
