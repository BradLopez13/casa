import { describe, expect, it } from 'vitest';

import { layoutFor } from './layout';
import { oneColumn, paneColumn, paneMode } from './panes';

describe('paneMode', () => {
  it('stacks on a compact phone in portrait', () => {
    expect(paneMode(layoutFor(390, 844))).toBe('stack');
  });

  it('stacks just below expanded', () => {
    expect(paneMode(layoutFor(599, 900))).toBe('stack');
    expect(paneMode(layoutFor(600, 900))).toBe('stack');
    expect(paneMode(layoutFor(839, 1100))).toBe('stack');
  });

  it('splits from expanded', () => {
    expect(paneMode(layoutFor(840, 1100))).toBe('split');
    expect(paneMode(layoutFor(1199, 800))).toBe('split');
  });

  it('splits on large screens', () => {
    expect(paneMode(layoutFor(1200, 800))).toBe('split');
    expect(paneMode(layoutFor(1920, 1080))).toBe('split');
  });

  it('splits a phone in landscape wide enough to be expanded', () => {
    expect(paneMode(layoutFor(844, 390))).toBe('split');
  });
});

describe('paneColumn', () => {
  const insets = { left: 47, right: 34 };

  it('is the gutter alone with no safe areas', () => {
    expect(paneColumn(layoutFor(390, 844), { left: 0, right: 0 }, false)).toEqual({
      paddingLeft: 20,
      paddingRight: 20,
      maxWidth: 680,
    });
  });

  it('adds both side safe areas away from the rail', () => {
    expect(paneColumn(layoutFor(844, 390), insets, false)).toEqual({
      paddingLeft: 32 + 47,
      paddingRight: 32 + 34,
      maxWidth: 1200 + 79 + 66,
    });
  });

  it('leaves the left safe area to the rail beside it', () => {
    expect(paneColumn(layoutFor(844, 390), insets, true)).toEqual({
      paddingLeft: 32,
      paddingRight: 32 + 34,
      maxWidth: 1200 + 32 + 66,
    });
  });

  it('keeps the large gutter on large screens', () => {
    const column = paneColumn(layoutFor(1440, 900), { left: 0, right: 0 }, true);
    expect(column.paddingLeft).toBe(48);
    expect(column.maxWidth).toBe(1296);
  });
});

describe('oneColumn', () => {
  const insets = { left: 47, right: 34 };

  it('gives a compact phone in portrait the 20 dp each side it has always had', () => {
    expect(oneColumn(layoutFor(390, 844), { left: 0, right: 0 }, false)).toEqual({
      paddingLeft: 20,
      paddingRight: 20,
      maxWidth: 680,
    });
  });

  it('caps a medium tablet in portrait at the one-column width', () => {
    expect(oneColumn(layoutFor(768, 1024), { left: 0, right: 0 }, false)).toEqual({
      paddingLeft: 24,
      paddingRight: 24,
      maxWidth: 640 + 48,
    });
  });

  it('keeps a medium phone on its side clear of both side safe areas', () => {
    expect(oneColumn(layoutFor(800, 360), insets, false)).toEqual({
      paddingLeft: 24 + 47,
      paddingRight: 24 + 34,
      maxWidth: 640 + 71 + 58,
    });
  });

  it('stays at the one-column width on a wide screen, beside the rail', () => {
    expect(oneColumn(layoutFor(1440, 900), insets, true)).toEqual({
      paddingLeft: 48,
      paddingRight: 48 + 34,
      maxWidth: 640 + 48 + 82,
    });
  });
});
