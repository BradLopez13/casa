// Pure: no react-native import, so Vitest can check it.
import type { Palette } from './tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

/** busy: waiting for the server, with a spinner in place of the label. */
export type ButtonState = 'enabled' | 'disabled' | 'busy';

export type ButtonLook = { fill: string; border: string; foreground: string };

/**
 * The colours of a pill button. A disabled one, whatever its variant, is an empty pill with an
 * `outline` border and `muted` text: it waits by shape (outline, then filled once it can be
 * pressed), never by fading, so its text stays readable in both themes. A busy one keeps its
 * variant, so the spinner sits on the same pill.
 */
export function buttonLook(
  variant: ButtonVariant,
  state: ButtonState,
  colors: Palette,
): ButtonLook {
  if (state === 'disabled') {
    return { fill: 'transparent', border: colors.outline, foreground: colors.muted };
  }
  if (variant === 'primary') {
    return { fill: colors.cobalt, border: colors.cobalt, foreground: colors.onCobalt };
  }
  const tone = variant === 'danger' ? colors.red : colors.cobalt;
  return { fill: 'transparent', border: tone, foreground: tone };
}

/** Opacity is only the press feedback; a disabled button is never faded. */
export function pressedOpacity(pressed: boolean): number {
  return pressed ? 0.8 : 1;
}
