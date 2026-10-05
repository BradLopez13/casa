import { describe, expect, it } from 'vitest';
import { MAGNET_COLORS } from '@/domain/members/marks';
import { contrastRatio } from './contrast';
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

  it.each([
    ['page', p.page],
    ['note', p.note],
  ])('overdue red on %s', (_, ground) => {
    expect(contrastRatio(p.red, ground)).toBeGreaterThanOrEqual(AA_TEXT);
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
