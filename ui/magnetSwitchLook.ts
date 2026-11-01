// Pure: no react-native import, so Vitest can check it.
import type { Palette } from './tokens';

export type MagnetSwitchLook = {
  /** The disc's fill. */
  fill: string;
  /** The disc's ring: the fill itself when on. */
  edge: string;
  /** A bell when on, the crossed bell when off or paused, so state reads by shape too. */
  glyph: 'bell' | 'bell-off-outline';
  glyphColor: string;
  /** Stuck to the note: the magnet's shadow, only when on. */
  raised: boolean;
  /** Paused (disabled): the ring is dashed, and dashed means nothing else. */
  dashed: boolean;
};

/**
 * How a switch is drawn (fase 10f): a magnet that sticks when on. On, the slate magnet
 * (`selection`) with the bell in `onSelection` and its shadow; off, the bare `outline` ring, flat,
 * with the crossed bell in `ink`, so the off state reads on its own (decisión 3 de Brad, 27 de
 * octubre; in `muted` it nearly vanished in dark); paused (the phone has notifications off), the
 * same ring dashed, the bell in `muted`.
 * A switch that is only busy (asking the phone, saving) keeps the look of its value. State reads by fill, glyph and relief, not by colour alone, and each
 * part is at least 3:1 on the page and on a note.
 */
export function magnetSwitchLook(
  value: boolean,
  colors: Pick<Palette, 'selection' | 'onSelection' | 'outline' | 'muted' | 'ink'>,
  disabled = false,
): MagnetSwitchLook {
  if (!disabled && value) {
    return {
      fill: colors.selection,
      edge: colors.selection,
      glyph: 'bell',
      glyphColor: colors.onSelection,
      raised: true,
      dashed: false,
    };
  }
  return {
    fill: 'transparent',
    edge: colors.outline,
    glyph: 'bell-off-outline',
    glyphColor: disabled ? colors.muted : colors.ink,
    raised: false,
    dashed: disabled,
  };
}
