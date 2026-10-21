import type { Palette } from './tokens';

/** A ticked box: the magnet fills with the accent. Unticked, it is the bare ring (no check). */
export type MagnetCheck = 'filled';

/**
 * Pure: how a ticked magnet is drawn: the accent fill with its check on top. An unticked one has
 * no faint check inside (fase 9b): at large text it read as half ticked.
 */
export function magnetCheckStyle(colors: Pick<Palette, 'accent' | 'onAccent'>): {
  tint: string;
  fill: string;
} {
  return { tint: colors.onAccent, fill: colors.accent };
}
