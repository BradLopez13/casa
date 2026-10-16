import { describe, expect, it } from 'vitest';
import { MAGNET_COLORS } from '@/domain/members/marks';
import { contrastRatio, hueDistance } from './contrast';
import { toggleLook } from './toggleLook';
import { palettes, type Scheme } from './tokens';

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for a colour on itself', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#2D4FA8', '#2D4FA8')).toBeCloseTo(1, 5);
  });

  it('does not depend on which colour is the foreground', () => {
    expect(contrastRatio('#56626E', '#F3F5F7')).toBeCloseTo(contrastRatio('#F3F5F7', '#56626E'));
  });

  it('accepts short hex and lower case', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 5);
  });

  it('matches a known WCAG value', () => {
    // #767676 on white is the classic 4.54:1 grey.
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
  });

  it('rejects a colour it cannot read', () => {
    expect(() => contrastRatio('red', '#FFFFFF')).toThrow();
  });
});

describe('hueDistance', () => {
  it('measures the shorter way round the colour wheel', () => {
    expect(hueDistance('#FF0000', '#00FF00')).toBeCloseTo(120, 5);
    expect(hueDistance('#FF0000', '#FF0040')).toBeCloseTo(15, 0);
    expect(hueDistance('#FF0040', '#FF0000')).toBeCloseTo(15, 0);
  });
});

describe('dark palette keeps red apart from apricot', () => {
  it('red sits at least 30° of hue away from the action colour', () => {
    // Both are light salmon tones on navy: by hue alone "Vencida" must not read as tappable.
    expect(hueDistance(palettes.dark.red, palettes.dark.cobalt)).toBeGreaterThanOrEqual(30);
  });
});

describe.each<Scheme>(['light', 'dark'])('%s palette meets WCAG AA', (scheme) => {
  const p = palettes[scheme];
  const grounds = { page: p.page, door: p.door, note: p.note };

  it.each(Object.entries(grounds))('ink and muted text on %s', (_, ground) => {
    expect(contrastRatio(p.ink, ground)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(p.muted, ground)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(p.mutedStrong, ground)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(Object.entries(grounds))('cobalt text on %s', (_, ground) => {
    expect(contrastRatio(p.cobalt, ground)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('text on a cobalt pill', () => {
    expect(contrastRatio(p.onCobalt, p.cobalt)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(Object.entries(grounds))('overdue and danger red on %s', (_, ground) => {
    expect(contrastRatio(p.red, ground)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('text, actions and outlines on the door panel', () => {
    expect(contrastRatio(p.ink, p.door)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(p.muted, p.door)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(p.mutedStrong, p.door)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(p.red, p.door)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(p.cobalt, p.door)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(p.outline, p.door)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  it.each(Object.entries(grounds))('high-contrast muted text beats muted on %s', (_, ground) => {
    expect(contrastRatio(p.mutedStrong, ground)).toBeGreaterThan(contrastRatio(p.muted, ground));
  });

  it.each(MAGNET_COLORS)('magnet initial on %s', (color) => {
    expect(contrastRatio(p.magnetInk, p.magnet[color])).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('refresh label on the fridge light', () => {
    expect(contrastRatio(p.light.text, p.light.top)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(p.light.text, p.page)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(Object.entries(grounds))('field and dashed outlines on %s', (_, ground) => {
    expect(contrastRatio(p.outline, ground)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });
});

describe.each<Scheme>(['light', 'dark'])('%s switch stands out from its ground', (scheme) => {
  const p = palettes[scheme];
  const grounds = { page: p.page, note: p.note };

  // WCAG 1.4.11: the parts that show a switch and its state need 3:1 against what is around them.
  it.each(Object.entries(grounds))('off: track and thumb on %s', (_, ground) => {
    const off = toggleLook(false, p);
    expect(contrastRatio(off.track, ground)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(contrastRatio(off.thumb, ground)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  it.each(Object.entries(grounds))('on: track on %s, thumb on the track', (_, ground) => {
    const on = toggleLook(true, p);
    expect(contrastRatio(on.track, ground)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(contrastRatio(on.thumb, on.track)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });
});

describe.each<Scheme>(['light', 'dark'])('%s button colours', (scheme) => {
  const p = palettes[scheme];

  it('cobalt text on the tonal pill', () => {
    expect(contrastRatio(p.cobalt, p.tonal)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('the tonal pill stands out from the door and the page', () => {
    expect(contrastRatio(p.tonal, p.door)).toBeGreaterThanOrEqual(1.2);
    expect(contrastRatio(p.tonal, p.page)).toBeGreaterThanOrEqual(1.2);
  });

  it('red text on the page and on a note', () => {
    expect(contrastRatio(p.red, p.page)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(p.red, p.note)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('text on a red pill', () => {
    expect(contrastRatio(p.onRed, p.red)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('muted text on the page and on a note', () => {
    expect(contrastRatio(p.muted, p.page)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(p.muted, p.note)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});
