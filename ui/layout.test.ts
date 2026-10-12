import { describe, expect, it } from 'vitest';

import { layoutFor, paneGap, RAIL_WIDTH, SHEET_WIDTH } from './layout';

describe('layoutFor', () => {
  it('classifies compact below 600', () => {
    const l = layoutFor(599, 900);
    expect(l.size).toBe('compact');
    expect(l.twoPane).toBe(false);
    expect(l.rail).toBe(false);
  });

  it('classifies a phone portrait as compact with one column', () => {
    const l = layoutFor(390, 844);
    expect(l).toMatchObject({ size: 'compact', contentMax: 640, gutter: 20, landscape: false });
  });

  it('classifies medium from 600', () => {
    expect(layoutFor(600, 900).size).toBe('medium');
    const l = layoutFor(839, 600);
    expect(l.size).toBe('medium');
    expect(l.landscape).toBe(true);
    expect(l.twoPane).toBe(false);
  });

  it('classifies expanded from 840 with two panes and rail', () => {
    const l = layoutFor(840, 600);
    expect(l).toMatchObject({ size: 'expanded', twoPane: true, rail: true, contentMax: 1200 });
    expect(layoutFor(1199, 800).size).toBe('expanded');
  });

  it('classifies large from 1200', () => {
    expect(layoutFor(1200, 800)).toMatchObject({
      size: 'large',
      twoPane: true,
      rail: true,
      contentMax: 1200,
      gutter: 48,
    });
  });

  it('flags short heights below 500', () => {
    expect(layoutFor(800, 499).shortHeight).toBe(true);
    expect(layoutFor(800, 500).shortHeight).toBe(false);
  });

  it('exposes fixed measures', () => {
    expect(RAIL_WIDTH).toBe(88);
    expect(SHEET_WIDTH).toBe(560);
    expect(paneGap('expanded')).toBe(32);
    expect(paneGap('large')).toBe(48);
  });
});
