import { describe, expect, it } from 'vitest';
import { clearOf, hasMoreBelow } from './moreBelow';
import { palettes } from './tokens';

describe('hasMoreBelow', () => {
  it('says there is more while the content runs past the bottom edge', () => {
    expect(hasMoreBelow(600, 0, 300)).toBe(true);
    expect(hasMoreBelow(600, 200, 300)).toBe(true);
  });

  it('is quiet at the end, give or take a rounding pixel', () => {
    expect(hasMoreBelow(600, 300, 300)).toBe(false);
    expect(hasMoreBelow(600, 295, 300)).toBe(false);
  });

  it('is quiet when everything fits, or before the first layout', () => {
    expect(hasMoreBelow(200, 0, 300)).toBe(false);
    expect(hasMoreBelow(600, 0, 0)).toBe(false);
  });
});

describe('clearOf', () => {
  it('clears a six-digit colour, so the fade starts from the page itself', () => {
    expect(clearOf('#F3F4F0')).toBe('#F3F4F000');
  });

  it('falls back to transparent for anything else', () => {
    expect(clearOf('rgba(0,0,0,0.1)')).toBe('transparent');
  });

  it('keeps every page token a six-digit colour', () => {
    expect(clearOf(palettes.light.page)).not.toBe('transparent');
    expect(clearOf(palettes.dark.page)).not.toBe('transparent');
  });
});
