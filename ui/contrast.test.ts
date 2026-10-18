import { describe, expect, it } from 'vitest';
import { MAGNET_COLORS } from '@/domain/members/marks';
import { contrastRatio, hueDistance } from './contrast';
import { toggleLook } from './toggleLook';
import { palettes, shadows, type Scheme } from './tokens';

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

describe.each<Scheme>(['light', 'dark'])('%s task note paper', (scheme) => {
  const p = palettes[scheme];

  it('ink, muted text and outlines on the task note', () => {
    expect(contrastRatio(p.ink, p.taskNote)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(p.muted, p.taskNote)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(p.outline, p.taskNote)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });
});

it('the dark task note is the dark note', () => {
  expect(palettes.dark.taskNote).toBe(palettes.dark.note);
});

describe('dark palette keeps red apart from the pósit', () => {
  it('red sits at least 30° of hue away from the pósit accent and the chalk selection', () => {
    // By hue alone "Vencida" must not read as chosen or tappable.
    expect(hueDistance(palettes.dark.red, palettes.dark.selection)).toBeGreaterThanOrEqual(30);
    expect(hueDistance(palettes.dark.red, palettes.dark.accent)).toBeGreaterThanOrEqual(30);
  });
});

describe('the light door', () => {
  // The enamel door has to read as its own panel against the paper, not as a faint tint of it.
  it('stands apart from the paper', () => {
    expect(contrastRatio(palettes.light.door, palettes.light.page)).toBeGreaterThanOrEqual(1.3);
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

  it('high-contrast muted text reaches AAA on the page', () => {
    expect(contrastRatio(p.mutedStrong, p.page)).toBeGreaterThanOrEqual(7);
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
  it.each(Object.entries(grounds))('off: track, edge and thumb on %s', (_, ground) => {
    const off = toggleLook(false, p, ground);
    expect(off.track).toBe(ground);
    expect(contrastRatio(off.trackBorder, ground)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(contrastRatio(off.thumb, ground)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(off.check).toBe(false);
  });

  it.each(Object.entries(grounds))('on: track on %s, thumb on the track', (_, ground) => {
    const on = toggleLook(true, p, ground);
    expect(on.track).toBe(p.selection);
    expect(contrastRatio(on.track, ground)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(contrastRatio(on.thumb, on.track)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(on.check).toBe(true);
  });

  it('on in dark: the thumb is the dark slate and keeps its edge', () => {
    const on = toggleLook(true, palettes.dark, palettes.dark.page);
    expect(on.thumb).toBe('#151B1E');
    expect(on.thumbBorder).toBe('#151B1E');
  });
});

describe.each<Scheme>(['light', 'dark'])('%s button colours', (scheme) => {
  const p = palettes[scheme];

  it('cobalt text on the tonal pill', () => {
    expect(contrastRatio(p.cobalt, p.tonal)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('text on the yellow primary pill', () => {
    expect(contrastRatio(p.onAccent, p.accent)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('the light primary pill casts a shadow and the dark one none', () => {
    expect(shadows.light.primary.shadowOpacity).toBeGreaterThan(0);
    expect(shadows.dark.primary.shadowOpacity).toBe(0);
  });

  it('text on a selection fill', () => {
    expect(contrastRatio(p.onSelection, p.selection)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(['page', 'note', 'door'] as const)('a selection fill stands out on %s', (g) => {
    expect(contrastRatio(p.selection, p[g])).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  it.each(['page', 'note', 'door'] as const)('the focus ring stands out on %s', (g) => {
    expect(contrastRatio(p.focusRing, p[g])).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  it('chalk text on the brand band', () => {
    expect(contrastRatio(p.onBrandBand, p.brandBand)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('the tonal pill shows its shape by fill or by edge', () => {
    const byFill = Math.min(contrastRatio(p.tonal, p.door), contrastRatio(p.tonal, p.page));
    const byEdge = Math.min(contrastRatio(p.tonalEdge, p.door), contrastRatio(p.tonalEdge, p.page));
    expect(byFill >= 1.2 || byEdge >= AA_NON_TEXT).toBe(true);
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

describe('Pizarra y pósit', () => {
  const retired = ['#263663', '#F0AD83', '#FFF6E8', '#FBE0CD', '#C9725C', '#E39A85', '#A8891A'];
  it.each<Scheme>(['light', 'dark'])('%s palette uses no retired brand colour', (scheme) => {
    const values = JSON.stringify(palettes[scheme]).toUpperCase();
    retired.forEach((hex) => expect(values).not.toContain(hex));
  });
  it('fills the main action with the pósit in both themes', () => {
    expect(palettes.light.accent).toBe('#F2D04B');
    expect(palettes.dark.accent).toBe('#F2D04B');
  });
  it('keeps the pósit for the main action and uses chalk for what is chosen in dark mode', () => {
    expect(palettes.dark.cobalt).toBe('#ECEFEA');
    expect(palettes.dark.selection).toBe('#ECEFEA');
  });
  it('uses a leaf magnet instead of coral', () => {
    expect(MAGNET_COLORS).not.toContain('coral');
    expect(MAGNET_COLORS).toContain('leaf');
  });
});
