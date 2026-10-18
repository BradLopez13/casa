import { describe, expect, it } from 'vitest';
import { magnetCheckStyle } from './magnetCheck';
import { palettes, type Scheme } from './tokens';

describe.each<Scheme>(['light', 'dark'])('magnetCheckStyle (%s)', (scheme) => {
  const colors = palettes[scheme];

  it('draws the open check as a faint glyph with no fill, stronger in dark', () => {
    expect(magnetCheckStyle('faint', colors, scheme)).toEqual({
      tint: scheme === 'dark' ? colors.ink : colors.muted,
      opacity: scheme === 'dark' ? 0.7 : 0.4,
      fill: null,
    });
  });

  it('fills the magnet with the accent and draws the check on it', () => {
    expect(magnetCheckStyle('filled', colors, scheme)).toEqual({
      tint: colors.onAccent,
      opacity: 1,
      fill: colors.accent,
    });
  });
});
