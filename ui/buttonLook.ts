// Pure: no react-native import, so Vitest can check it.
import type { Palette } from './tokens';

/**
 * primary: the one main action. secondary: a tonal pill. outlined: an empty pill with a slate (or
 * chalk) edge, for a secondary action that sits on a note, where the tonal pill reads as disabled.
 * tertiary: bare text.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outlined' | 'tertiary';

/** destructive swaps cobalt for red; only primary and tertiary may be destructive. */
export type ButtonTone = 'default' | 'destructive';

/** busy: waiting for the server, with a spinner in place of the label. */
export type ButtonState = 'enabled' | 'disabled' | 'busy';

export type ButtonLook = {
  fill: string;
  border: string;
  foreground: string;
  /** Opacity of the label and icon: 1, or `DISABLED_LABEL_OPACITY` when disabled. */
  labelOpacity: number;
};

/**
 * A disabled label is `ink` at this opacity: still at least 3:1 where it lands on page, door and
 * note in both themes. Dashed edges are kept for a paused switch, so a disabled button waits by
 * its faded label on a solid edge.
 */
export const DISABLED_LABEL_OPACITY = 0.6;

/**
 * The colours of a button. A disabled primary or secondary is an empty pill with a solid `outline`
 * border and a faded `ink` label (`DISABLED_LABEL_OPACITY`). A disabled tertiary has no pill to
 * empty, so it is just the faded label. A busy one keeps the look of an enabled one, so the
 * spinner sits on the same pill.
 */
export function buttonLook(
  variant: ButtonVariant,
  tone: ButtonTone,
  state: ButtonState,
  colors: Palette,
): ButtonLook {
  if ((variant === 'secondary' || variant === 'outlined') && tone === 'destructive') {
    throw new Error(`A ${variant} button cannot be destructive`);
  }
  if (state === 'disabled') {
    return {
      fill: 'transparent',
      border: variant === 'tertiary' ? 'transparent' : colors.outline,
      foreground: colors.ink,
      labelOpacity: DISABLED_LABEL_OPACITY,
    };
  }
  if (variant === 'primary') {
    return tone === 'destructive'
      ? { fill: colors.red, border: colors.red, foreground: colors.onRed, labelOpacity: 1 }
      : {
          fill: colors.accent,
          border: colors.accentEdge,
          foreground: colors.onAccent,
          labelOpacity: 1,
        };
  }
  if (variant === 'outlined') {
    return {
      fill: 'transparent',
      border: colors.selection,
      foreground: colors.ink,
      labelOpacity: 1,
    };
  }
  if (variant === 'secondary') {
    return {
      fill: colors.tonal,
      border: colors.tonalEdge,
      foreground: colors.cobalt,
      labelOpacity: 1,
    };
  }
  return {
    fill: 'transparent',
    border: 'transparent',
    foreground: tone === 'destructive' ? colors.red : colors.cobalt,
    labelOpacity: 1,
  };
}

export type ButtonMetrics = {
  minHeight: number;
  fontSize: number;
  paddingV: number;
  paddingH: number;
  iconSize: number;
  /** Only the tertiary label is underlined: it has no pill to say it is a button. */
  underline: boolean;
};

const metrics: Record<ButtonVariant, ButtonMetrics> = {
  primary: {
    minHeight: 48,
    fontSize: 16,
    paddingV: 12,
    paddingH: 24,
    iconSize: 20,
    underline: false,
  },
  secondary: {
    minHeight: 44,
    fontSize: 15,
    paddingV: 10,
    paddingH: 20,
    iconSize: 20,
    underline: false,
  },
  outlined: {
    minHeight: 44,
    fontSize: 15,
    paddingV: 10,
    paddingH: 20,
    iconSize: 20,
    underline: false,
  },
  tertiary: {
    minHeight: 44,
    fontSize: 15,
    paddingV: 8,
    paddingH: 12,
    iconSize: 18,
    underline: true,
  },
};

/** Sizes per level. Heights are minimums, so the button grows with the system text size. */
export function buttonMetrics(variant: ButtonVariant): ButtonMetrics {
  return metrics[variant];
}

/** The press feedback; a disabled button fades its label instead (`labelOpacity`). */
export function pressedOpacity(pressed: boolean): number {
  return pressed ? 0.8 : 1;
}
