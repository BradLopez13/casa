import { describe, expect, it } from 'vitest';
import { MAGNET_DROP_OFFSET, magnetDrop } from './magnetDrop';
import { palettes } from './tokens';

describe('magnetDrop', () => {
  it('draws no drop in light, where the shadow already shows', () => {
    expect(magnetDrop(palettes.light, true)).toBeNull();
  });

  it('draws a dark disc just under a raised magnet in dark (fase 10f)', () => {
    expect(magnetDrop(palettes.dark, true)).toEqual({
      color: palettes.dark.magnetDrop,
      offset: MAGNET_DROP_OFFSET,
    });
    expect(MAGNET_DROP_OFFSET).toBe(2);
  });

  it('leaves flat magnets alone: a small one inside a row, an empty ring', () => {
    expect(magnetDrop(palettes.dark, false)).toBeNull();
  });
});
