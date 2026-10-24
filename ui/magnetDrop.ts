// Pure: no react-native import, so Vitest can check it.
import type { Palette } from './tokens';

/** How far under the magnet its drawn drop sits. */
export const MAGNET_DROP_OFFSET = 2;

/**
 * The drop drawn under a raised magnet: in dark the shadow is lost on the slate note and the
 * magnet read as a painted circle, so a darker disc of the same size sits just below it, behind
 * it (fase 10f). It does not hang on `elevation`, so every Android shows it. Light has none: its
 * shadow already shows.
 */
export function magnetDrop(
  colors: Pick<Palette, 'magnetDrop'>,
  raised: boolean,
): { color: string; offset: number } | null {
  if (!raised || colors.magnetDrop === 'transparent') return null;
  return { color: colors.magnetDrop, offset: MAGNET_DROP_OFFSET };
}
