// Pure: no react-native import, so Vitest can check it.
import type { Palette } from './tokens';

/** primary: the one main action. secondary: a tonal pill. tertiary: bare text. */
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

/** destructive swaps cobalt for red; only primary and tertiary may be destructive. */
export type ButtonTone = 'default' | 'destructive';

/** busy: waiting for the server, with a spinner in place of the label. */
export type ButtonState = 'enabled' | 'disabled' | 'busy';

export type ButtonLook = { fill: string; border: string; foreground: string };

/**
 * The colours of a button. A disabled primary or secondary is an empty pill with an `outline`
 * border and `muted` text: it waits by shape, never by fading, so its text stays readable in both
 * themes. A disabled tertiary has no pill to empty, so it is just `muted` text. A busy one keeps
 * the look of an enabled one, so the spinner sits on the same pill.
 */
export function buttonLook(
  variant: ButtonVariant,
  tone: ButtonTone,
  state: ButtonState,
  colors: Palette,
): ButtonLook {
  if (variant === 'secondary' && tone === 'destructive') {
    throw new Error('A secondary button cannot be destructive');
  }
  if (state === 'disabled') {
    return {
      fill: 'transparent',
      border: variant === 'tertiary' ? 'transparent' : colors.outline,
      foreground: colors.muted,
    };
  }
  if (variant === 'primary') {
    return tone === 'destructive'
      ? { fill: colors.red, border: colors.red, foreground: colors.onRed }
      : { fill: colors.accent, border: colors.accent, foreground: colors.onAccent };
  }
  if (variant === 'secondary') {
    return { fill: colors.tonal, border: colors.tonalEdge, foreground: colors.cobalt };
  }
  return {
    fill: 'transparent',
    border: 'transparent',
    foreground: tone === 'destructive' ? colors.red : colors.cobalt,
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

/** Opacity is only the press feedback; a disabled button is never faded. */
export function pressedOpacity(pressed: boolean): number {
  return pressed ? 0.8 : 1;
}
