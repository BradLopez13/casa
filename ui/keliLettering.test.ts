import { describe, expect, it } from 'vitest';
import { RAIL_WIDTH } from './layout';
import {
  BESIDE_SIGNATURE,
  KELI_LETTERING_DOT,
  KELI_LETTERING_PATH,
  KELI_LETTERING_VIEWBOX,
  brandSignatureSizes,
  letteringWidth,
} from './keliLettering';

describe('keli lettering', () => {
  it('is the geometry of assets/brand/keli/lettering.svg', () => {
    expect(KELI_LETTERING_VIEWBOX).toBe('0 0 1694 760');
    expect(KELI_LETTERING_PATH.startsWith('M56 750')).toBe(true);
    expect(KELI_LETTERING_PATH.endsWith('Z')).toBe(true);
    expect(KELI_LETTERING_DOT).toEqual({ cx: 1609, cy: 105, r: 85 });
  });

  it('keeps its proportion at any height', () => {
    expect(letteringWidth(760)).toBeCloseTo(1694);
    expect(letteringWidth(40)).toBeCloseTo(89.2, 1);
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

it('stacks the signature inside the rail when the phone is on its side', () => {
  expect(letteringWidth(BESIDE_SIGNATURE.lettering)).toBeLessThanOrEqual(RAIL_WIDTH - 2 * 8);
  expect(BESIDE_SIGNATURE.symbol).toBeLessThanOrEqual(RAIL_WIDTH - 2 * 8);
});
