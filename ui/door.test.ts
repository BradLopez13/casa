import { describe, expect, it } from 'vitest';

import { DOOR_TYPE, doorFor } from './door';
import { layoutFor } from './layout';

describe('DOOR_TYPE', () => {
  it('is the §14.4 hierarchy: eyebrow 13, headline 32 on 38 with the number at 36, line 16', () => {
    expect(DOOR_TYPE.full).toEqual({
      eyebrow: 13,
      heading: 32,
      lineHeight: 38,
      number: 36,
      secondary: 16,
    });
  });

  it('keeps the same hierarchy smaller in a compact door', () => {
    expect(DOOR_TYPE.compact).toMatchObject({ eyebrow: 12, heading: 24, secondary: 14 });
  });
});

describe('doorFor', () => {
  it('keeps the full door with its handle on a tall window', () => {
    expect(doorFor(layoutFor(390, 844), 844)).toEqual({
      compact: false,
      type: DOOR_TYPE.full,
      handle: true,
      maxHeight: null,
    });
  });

  it('stays full at exactly 500 high', () => {
    expect(doorFor(layoutFor(800, 500), 500).compact).toBe(false);
  });

  it('turns compact below 500 high: smaller type, no handle, at most 40% of the window', () => {
    expect(doorFor(layoutFor(844, 390), 390)).toEqual({
      compact: true,
      type: DOOR_TYPE.compact,
      handle: false,
      maxHeight: 156,
    });
    expect(doorFor(layoutFor(800, 499), 499)).toMatchObject({
      compact: true,
      type: DOOR_TYPE.compact,
      maxHeight: 199,
    });
  });

  it('is compact on a wide landscape phone too', () => {
    expect(doorFor(layoutFor(932, 430), 430).compact).toBe(true);
  });

  describe('above two panes, where the door stays fixed', () => {
    it('turns compact when the full door would take more than 40% of the window', () => {
      // A tablet in landscape beside the rail: the full door would be about 45% of it.
      expect(doorFor(layoutFor(1143, 686), 686)).toEqual({
        compact: true,
        type: DOOR_TYPE.compact,
        handle: false,
        maxHeight: 274,
      });
    });

    it('keeps the full door on a window tall enough for it', () => {
      expect(doorFor(layoutFor(1280, 800), 800).compact).toBe(false);
      expect(doorFor(layoutFor(840, 1100), 1100).compact).toBe(false);
    });

    it('turns compact sooner with enlarged text, as the full door grows with it', () => {
      expect(doorFor(layoutFor(1280, 800), 800, 1.3).compact).toBe(true);
      expect(doorFor(layoutFor(1280, 1200), 1200, 1.3).compact).toBe(false);
    });

    it('never grows the door for text smaller than the default', () => {
      expect(doorFor(layoutFor(1280, 740), 740, 0.85).compact).toBe(true);
    });
  });

  it('keeps the full door in one column whatever the text size: it scrolls away there', () => {
    expect(doorFor(layoutFor(390, 844), 844, 2).compact).toBe(false);
    expect(doorFor(layoutFor(800, 600), 600, 2).compact).toBe(false);
  });
});
