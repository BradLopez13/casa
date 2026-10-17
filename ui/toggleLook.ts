// Pure: no react-native import, so Vitest can check it.
import type { Palette } from './tokens';

export type ToggleLook = {
  track: string;
  trackBorder: string;
  thumb: string;
  thumbBorder: string;
  /** Whether the thumb carries a check mark. */
  check: boolean;
};

/**
 * The colours of a switch, read by fill, edge and mark rather than by hue. Off: an empty track
 * (the surface itself) with an `outline` edge and a `muted` thumb. On: a `selection` track, an
 * `onSelection` thumb and a check. Every part is at least 3:1 against the `surface` it is drawn
 * on (the page, or a note) and, for the thumb, against the track.
 */
export function toggleLook(value: boolean, colors: Palette, surface: string): ToggleLook {
  return value
    ? {
        track: colors.selection,
        trackBorder: colors.selection,
        thumb: colors.onSelection,
        thumbBorder: colors.onSelection,
        check: true,
      }
    : {
        track: surface,
        trackBorder: colors.outline,
        thumb: colors.muted,
        thumbBorder: colors.muted,
        check: false,
      };
}
