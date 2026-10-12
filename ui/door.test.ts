import { describe, expect, it } from 'vitest';

import { doorFor } from './door';
import { layoutFor } from './layout';

describe('doorFor', () => {
  it('keeps the full door with its handle on a tall window', () => {
    expect(doorFor(layoutFor(390, 844), 844, 'large')).toEqual({
      compact: false,
      titleSize: 44,
      handle: true,
      maxHeight: null,
    });
    expect(doorFor(layoutFor(390, 844), 844, 'medium').titleSize).toBe(38);
  });

  it('stays full at exactly 500 high', () => {
    expect(doorFor(layoutFor(800, 500), 500, 'large').compact).toBe(false);
  });

  it('turns compact below 500 high: title 28, no handle, at most 40% of the window', () => {
    expect(doorFor(layoutFor(844, 390), 390, 'large')).toEqual({
      compact: true,
      titleSize: 28,
      handle: false,
      maxHeight: 156,
    });
    expect(doorFor(layoutFor(800, 499), 499, 'medium')).toMatchObject({
      compact: true,
      titleSize: 28,
      maxHeight: 199,
    });
  });

  it('is compact on a wide landscape phone too', () => {
    expect(doorFor(layoutFor(932, 430), 430, 'medium').compact).toBe(true);
  });
});
