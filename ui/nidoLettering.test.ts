import { describe, expect, it } from 'vitest';
import {
  NIDO_LETTERING_DOT,
  NIDO_LETTERING_PATH,
  NIDO_LETTERING_VIEWBOX,
  brandSignatureSizes,
  letteringWidth,
} from './nidoLettering';

describe('nido lettering', () => {
  it('is the geometry of assets/brand/nido/lettering.svg', () => {
    expect(NIDO_LETTERING_VIEWBOX).toBe('0 0 2077 760');
    expect(NIDO_LETTERING_PATH.startsWith('M56 750')).toBe(true);
    expect(NIDO_LETTERING_PATH.endsWith('Z')).toBe(true);
    expect(NIDO_LETTERING_DOT).toEqual({ cx: 723, cy: 95, r: 95 });
  });

  it('keeps its proportion at any height', () => {
    expect(letteringWidth(760)).toBeCloseTo(2077);
    expect(letteringWidth(40)).toBeCloseTo(109.3, 1);
  });
});

describe('brand signature on the band', () => {
  it('sets the lettering at 0.62 of the symbol, 12 dp away', () => {
    const s = brandSignatureSizes('regular', false);
    expect(s.symbol).toBe(64);
    expect(s.lettering).toBeCloseTo(39.68);
    expect(s.gap).toBe(12);
  });

  it('grows on onboarding and shrinks in a short window', () => {
    expect(brandSignatureSizes('hero', false).symbol).toBe(80);
    expect(brandSignatureSizes('regular', true).symbol).toBe(48);
    expect(brandSignatureSizes('hero', true).symbol).toBe(48);
  });

  it('fits a 360 dp phone with its gutters', () => {
    const s = brandSignatureSizes('hero', false);
    expect(s.symbol + s.gap + letteringWidth(s.lettering)).toBeLessThan(360 - 2 * 24);
  });
});
