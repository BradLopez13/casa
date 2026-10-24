import { describe, expect, it } from 'vitest';
import { magnetSwitchLook } from './magnetSwitchLook';
import { palettes } from './tokens';

describe('magnetSwitchLook', () => {
  const p = palettes.light;

  it('on: the slate magnet stuck to the note, with the bell', () => {
    expect(magnetSwitchLook(true, p)).toEqual({
      fill: p.selection,
      edge: p.selection,
      glyph: 'bell',
      glyphColor: p.onSelection,
      raised: true,
      dashed: false,
    });
  });

  it('off: the bare ring, flat, with the crossed bell', () => {
    expect(magnetSwitchLook(false, p)).toEqual({
      fill: 'transparent',
      edge: p.outline,
      glyph: 'bell-off-outline',
      glyphColor: p.muted,
      raised: false,
      dashed: false,
    });
  });

  it('paused: the same ring dashed, whatever the value (dashed is paused and nothing else)', () => {
    for (const value of [true, false]) {
      expect(magnetSwitchLook(value, p, true)).toMatchObject({
        fill: 'transparent',
        edge: p.outline,
        glyph: 'bell-off-outline',
        raised: false,
        dashed: true,
      });
    }
  });
});
