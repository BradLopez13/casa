import { describe, expect, it } from 'vitest';

import { layoutFor } from './layout';
import { paneMode } from './panes';

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
