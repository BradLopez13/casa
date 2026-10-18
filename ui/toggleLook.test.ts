import { describe, expect, it } from 'vitest';
import { toggleLook } from './toggleLook';
import { palettes } from './tokens';

describe('toggleLook', () => {
  it('draws a disabled switch dashed with an outline-only thumb, on or off', () => {
    const p = palettes.light;
    for (const value of [true, false]) {
      const look = toggleLook(value, p, p.page, true);
      expect(look).toMatchObject({
        track: p.note,
        trackBorder: p.outline,
        thumb: 'transparent',
        thumbBorder: p.outline,
        check: false,
        dashed: true,
      });
    }
  });
  it('keeps the enabled looks solid', () => {
    const p = palettes.light;
    expect(toggleLook(true, p, p.page).dashed).toBe(false);
    expect(toggleLook(false, p, p.page).track).toBe(p.page);
  });
});
