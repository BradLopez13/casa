import { describe, expect, it } from 'vitest';
import { magnetCheckStyle } from './magnetCheck';
import { palettes, type Scheme } from './tokens';

describe.each<Scheme>(['light', 'dark'])('magnetCheckStyle (%s)', (scheme) => {
  const colors = palettes[scheme];

  it('draws the open check as a faint muted glyph with no fill', () => {
    expect(magnetCheckStyle('faint', colors)).toEqual({
      tint: colors.muted,
      opacity: 0.4,
      fill: null,
    });
  });

  it('fills the magnet with the accent and draws the check on it', () => {
    expect(magnetCheckStyle('filled', colors)).toEqual({
      tint: colors.onAccent,
      opacity: 1,
      fill: colors.accent,
    });
  });
});
