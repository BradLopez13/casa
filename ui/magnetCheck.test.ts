import { describe, expect, it } from 'vitest';
import { magnetCheckStyle } from './magnetCheck';
import { palettes, type Scheme } from './tokens';

describe.each<Scheme>(['light', 'dark'])('magnetCheckStyle (%s)', (scheme) => {
  const colors = palettes[scheme];

  it('fills the magnet with the accent and draws the check on it', () => {
    expect(magnetCheckStyle(colors)).toEqual({ tint: colors.onAccent, fill: colors.accent });
  });
});
