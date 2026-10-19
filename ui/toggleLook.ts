// Pure: no react-native import, so Vitest can check it.
import type { Palette } from './tokens';

export type ToggleLook = {
  track: string;
  trackBorder: string;
  thumb: string;
  thumbBorder: string;
  /** Whether the thumb carries a check mark. */
  check: boolean;
  /** The colour of that check. */
  checkColor: string;
  /** Whether the track edge is dashed (paused: disabled). */
  dashed: boolean;
};

/**
 * The colours of a switch, one polarity in both themes: the thumb is always light
 * (`toggleThumb`) and only a switch that is on fills its track (`toggleOn`, with a check on the
 * thumb in the same colour). Off: an empty track (the surface itself) with an `outline` edge and
 * the light thumb in an `outline` ring. Every part is at least 3:1 against the `surface` it is
 * drawn on (the page, or a note). Paused (disabled): a `note` track with a dashed `outline` edge
 * and an `outline` ring thumb, whatever the value; dashed means paused and nothing else.
 */
export function toggleLook(
  value: boolean,
  colors: Palette,
  surface: string,
  disabled = false,
): ToggleLook {
  if (disabled) {
    return {
      track: colors.note,
      trackBorder: colors.outline,
      thumb: 'transparent',
      thumbBorder: colors.outline,
      check: false,
      checkColor: colors.outline,
      dashed: true,
    };
  }
  return value
    ? {
        track: colors.toggleOn,
        trackBorder: colors.toggleOn,
        thumb: colors.toggleThumb,
        thumbBorder: colors.toggleThumb,
        check: true,
        checkColor: colors.toggleOn,
        dashed: false,
      }
    : {
        track: surface,
        trackBorder: colors.outline,
        thumb: colors.toggleThumb,
        thumbBorder: colors.outline,
        check: false,
        checkColor: colors.outline,
        dashed: false,
      };
}
