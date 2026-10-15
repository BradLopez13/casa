// Pure: no react-native import, so Vitest can check it.
import type { Palette } from './tokens';

export type ToggleLook = { track: string; thumb: string };

/**
 * The colours of a switch. On: the onCobalt thumb over the action colour. Off: a `muted` thumb
 * over an `outline` track, both at least 3:1 on the page and on a note in either theme, so the
 * switch never melts into its ground. (The thumb used to be the note colour, which in dark mode
 * is all but the page itself: only the thin track was left to see.)
 */
export function toggleLook(value: boolean, colors: Palette): ToggleLook {
  return value
    ? { track: colors.cobalt, thumb: colors.onCobalt }
    : { track: colors.outline, thumb: colors.muted };
}
