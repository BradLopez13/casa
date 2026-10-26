import { describe, expect, it } from 'vitest';

import { DOOR_HEADLINE_MAX_SCALE, DOOR_MAX_SCALE, DOOR_TYPE, doorFor, stripInDoor } from './door';
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
      holdsQuickAdd: false,
      beside: false,
    });
  });

  it('is not short at exactly 500 high: only the space rule can compact it there', () => {
    // 300 of 500 is 60 %: compact by space, in one column as above two panes.
    expect(doorFor(layoutFor(800, 500), 500)).toMatchObject({ compact: true, maxHeight: 200 });
    expect(doorFor({ shortHeight: false, twoPane: false }, 800).compact).toBe(false);
  });

  it('turns compact below 500 high: smaller type, no handle, at most 40% of the window', () => {
    expect(doorFor(layoutFor(844, 390), 390)).toEqual({
      compact: true,
      type: DOOR_TYPE.compact,
      handle: false,
      maxHeight: 156,
      // 844 wide is two panes: the quick add keeps its pane.
      holdsQuickAdd: false,
      beside: true,
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
        holdsQuickAdd: false,
        beside: true,
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

  describe('in one column, where the door scrolls away with the list', () => {
    it('keeps the full door at the default text while 300 dp is within half the window', () => {
      expect(doorFor(layoutFor(375, 817), 817, 1).compact).toBe(false);
      // An iPhone SE: 300 dp is 45 % of it, still under half.
      expect(doorFor(layoutFor(375, 667), 667, 1).compact).toBe(false);
      expect(doorFor(layoutFor(390, 600), 600, 1).compact).toBe(false);
    });

    it('turns compact as a safety net on a window under 600 dp high', () => {
      expect(doorFor(layoutFor(390, 560), 560, 1)).toMatchObject({
        compact: true,
        holdsQuickAdd: false,
        maxHeight: Math.floor(560 * 0.4),
      });
    });

    it('below ×1.3 keeps the full door on the .51', () => {
      expect(doorFor(layoutFor(375, 817), 817, 1.15).compact).toBe(false);
      expect(doorFor(layoutFor(375, 817), 817, 1.29).compact).toBe(false);
    });

    it('from ×1.3 compacts at 40 % with an estimate that grows with the text (fase 10b)', () => {
      // 300 × 1.3 = 390 dp, 48 % of the .51's 817: two whole notes need the room (PRODUCT.md,
      // the person with large text).
      expect(doorFor(layoutFor(375, 817), 817, 1.3)).toMatchObject({
        compact: true,
        holdsQuickAdd: false,
        maxHeight: Math.floor(817 * 0.45),
        beside: false,
      });
      expect(doorFor(layoutFor(375, 817), 817, 1.6).compact).toBe(true);
      expect(doorFor(layoutFor(375, 817), 817, 2).compact).toBe(true);
      // A tall one-column window keeps its full door: there is room.
      expect(doorFor(layoutFor(600, 1100), 1100, 1.4).compact).toBe(false);
    });
  });

  describe('beside', () => {
    it('lays hierarchy and controls side by side on a short window and above two panes', () => {
      expect(doorFor(layoutFor(817, 375), 375).beside).toBe(true);
      expect(doorFor(layoutFor(1143, 686), 686).beside).toBe(true);
    });

    it('stacks them on a phone held upright, compact at large text (fase 10b)', () => {
      expect(doorFor(layoutFor(375, 817), 817, 1.6).beside).toBe(false);
    });
  });

  it('stops growing its estimate at the door’s 1.4 text cap', () => {
    expect(DOOR_MAX_SCALE).toBe(1.4);
    expect(doorFor(layoutFor(1280, 1100), 1100, 2)).toEqual(
      doorFor(layoutFor(1280, 1100), 1100, 1.4),
    );
  });

  describe('holdsQuickAdd', () => {
    it('takes the quick add inside a compact door on a short window in one column', () => {
      expect(doorFor(layoutFor(817, 375), 375).holdsQuickAdd).toBe(true);
    });

    it('leaves it outside a full door and above two panes', () => {
      expect(doorFor(layoutFor(375, 817), 817).holdsQuickAdd).toBe(false);
      expect(doorFor(layoutFor(873, 393), 393).holdsQuickAdd).toBe(false);
      expect(doorFor(layoutFor(1143, 686), 686).holdsQuickAdd).toBe(false);
    });
  });

  describe('large text on a phone on its side', () => {
    // At ×1,3 and up the compact door's hierarchy, controls and day strip need more than 40 %:
    // the quick add leaves for the list and the door may take 45 %, so the strip stays whole.
    it('moves the quick add out and lets the door take 45 %', () => {
      expect(doorFor(layoutFor(817, 375), 375, 1.3)).toMatchObject({
        compact: true,
        holdsQuickAdd: false,
        maxHeight: Math.floor(375 * 0.45),
      });
      expect(doorFor(layoutFor(817, 375), 375, 2)).toMatchObject({
        holdsQuickAdd: false,
        maxHeight: Math.floor(375 * 0.45),
      });
    });

    it('keeps 40 % and the quick add inside below that', () => {
      expect(doorFor(layoutFor(817, 375), 375, 1.2)).toMatchObject({
        holdsQuickAdd: true,
        maxHeight: Math.floor(375 * 0.4),
      });
    });
  });

  it('keeps the headline above a note title at ×2, even in a compact door (fase 10b)', () => {
    const noteTitle = 17 * 2;
    expect(DOOR_TYPE.compact.heading * DOOR_HEADLINE_MAX_SCALE).toBeGreaterThan(noteTitle);
    expect(DOOR_TYPE.full.heading * DOOR_HEADLINE_MAX_SCALE).toBeGreaterThan(noteTitle);
  });
});

describe('stripInDoor', () => {
  // Bloque 11 (11.2): at ×1.6 on the .51 the quick add, its hint and the day pills stacked about
  // 250 dp between the door and the first note, so two notes of four lines (a title on two, the
  // room, «De días anteriores» on two) no longer fitted. With the hint quiet and the pills beside
  // the magnets only the quick add stays above the first note.
  it('brings the day pills into the compact door of a phone held upright at large text', () => {
    expect(stripInDoor(doorFor(layoutFor(392, 817), 817, 1.6))).toBe(true);
    expect(stripInDoor(doorFor(layoutFor(392, 817), 817, 2))).toBe(true);
    expect(stripInDoor(doorFor(layoutFor(392, 817), 817, 1.3))).toBe(true);
  });

  it('brings them beside the quick add in the door of a phone on its side', () => {
    expect(stripInDoor(doorFor(layoutFor(817, 392), 392, 1))).toBe(true);
  });

  it('leaves them in the list under a full door and above two panes', () => {
    expect(stripInDoor(doorFor(layoutFor(392, 817), 817, 1))).toBe(false);
    expect(stripInDoor(doorFor(layoutFor(1143, 686), 686))).toBe(false);
    // On its side at large text the quick add goes to the list: the pills go with it.
    expect(stripInDoor(doorFor(layoutFor(817, 392), 392, 1.6))).toBe(false);
  });
});
