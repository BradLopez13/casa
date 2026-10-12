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

  describe('above two panes, where the door stays fixed', () => {
    it('turns compact when the full door would take more than 40% of the window', () => {
      // A tablet in landscape beside the rail: the full door would be about 45% of it.
      expect(doorFor(layoutFor(1143, 686), 686, 'large')).toEqual({
        compact: true,
        titleSize: 28,
        handle: false,
        maxHeight: 274,
      });
    });

    it('keeps the full door on a window tall enough for it', () => {
      expect(doorFor(layoutFor(1280, 800), 800, 'large').compact).toBe(false);
      expect(doorFor(layoutFor(840, 1100), 1100, 'medium').compact).toBe(false);
    });

    it('turns compact sooner with enlarged text, as the full door grows with it', () => {
      expect(doorFor(layoutFor(1280, 800), 800, 'large', 1.3).compact).toBe(true);
      expect(doorFor(layoutFor(1280, 1200), 1200, 'large', 1.3).compact).toBe(false);
    });

    it('never grows the door for text smaller than the default', () => {
      expect(doorFor(layoutFor(1280, 740), 740, 'large', 0.85).compact).toBe(true);
    });
  });

  it('keeps the full door in one column whatever the text size: it scrolls away there', () => {
    expect(doorFor(layoutFor(390, 844), 844, 'large', 2).compact).toBe(false);
    expect(doorFor(layoutFor(800, 600), 600, 'medium', 2).compact).toBe(false);
  });
});
