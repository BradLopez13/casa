import { describe, expect, it } from 'vitest';
import {
  TAB_BAR_BESIDE_HEIGHT,
  TAB_BAR_HEIGHT,
  TAB_BAR_PAD,
  TAB_LABEL_GAP,
  TAB_LABEL_LINE,
  TAB_LABEL_MAX_SCALE,
  TAB_MAGNET,
  tabBarClearance,
  tabBarHeight,
  tabLabelsBeside,
} from './tabBar';

describe('tabLabelsBeside', () => {
  it('puts labels under the icons on a phone in portrait', () => {
    expect(tabLabelsBeside(412, 915)).toBe(false);
  });

  it('puts them beside the icons on a phone on its side and on a tablet', () => {
    expect(tabLabelsBeside(915, 412)).toBe(true);
    expect(tabLabelsBeside(768, 1024)).toBe(true);
  });
});

describe('tabBarHeight', () => {
  const portrait = { width: 412, height: 915, bottomInset: 24 };

  it('fits the 40 dp pósit plus the label line at the default text size', () => {
    expect(TAB_MAGNET).toBe(40);
    expect(TAB_BAR_HEIGHT).toBe(TAB_BAR_PAD + TAB_MAGNET + TAB_LABEL_LINE + TAB_BAR_PAD);
    expect(tabBarHeight({ ...portrait, fontScale: 1 })).toBe(TAB_BAR_HEIGHT + 24);
    expect(tabBarHeight({ ...portrait, fontScale: 0.85, bottomInset: 0 })).toBe(TAB_BAR_HEIGHT);
  });

  it('grows with the label under the icon, keeping the bottom inset', () => {
    // MIUI's largest text: a 16 dp label line becomes 23.2, so the bar grows by 8.
    expect(tabBarHeight({ ...portrait, fontScale: 1.45 })).toBe(TAB_BAR_HEIGHT + 8 + 24);
    expect(tabBarHeight({ ...portrait, fontScale: 1.3, bottomInset: 0 })).toBe(TAB_BAR_HEIGHT + 5);
  });

  it('stops growing where the label stops: at the rail’s 1.6', () => {
    expect(TAB_LABEL_MAX_SCALE).toBe(1.6);
    expect(tabBarHeight({ ...portrait, fontScale: 2 })).toBe(
      tabBarHeight({ ...portrait, fontScale: 1.6 }),
    );
    expect(tabBarHeight({ ...portrait, fontScale: 1.6, bottomInset: 0 })).toBe(TAB_BAR_HEIGHT + 10);
  });

  it('is one pósit tall with the labels beside the icons, where even the largest label fits', () => {
    expect(TAB_LABEL_LINE * TAB_LABEL_MAX_SCALE).toBeLessThanOrEqual(TAB_MAGNET);
    expect(tabBarHeight({ width: 915, height: 412, bottomInset: 0, fontScale: 1.45 })).toBe(
      TAB_BAR_BESIDE_HEIGHT,
    );
    expect(tabBarHeight({ width: 915, height: 412, bottomInset: 20, fontScale: 1 })).toBe(
      TAB_BAR_BESIDE_HEIGHT + 20,
    );
  });

  it('leaves at least 8 dp between the pósit and a label beside it', () => {
    expect(TAB_LABEL_GAP).toBeGreaterThanOrEqual(8);
  });
});

describe('tabBarClearance', () => {
  it('is the bar with the inset when the bar is at the bottom', () => {
    expect(
      tabBarClearance({ width: 412, height: 915, fontScale: 1, bottomInset: 24, rail: false }),
    ).toBe(TAB_BAR_HEIGHT + 24);
    expect(
      tabBarClearance({ width: 412, height: 915, fontScale: 1.6, bottomInset: 0, rail: false }),
    ).toBe(TAB_BAR_HEIGHT + 10);
  });

  it('is the one-row bar when the labels sit beside the icons', () => {
    expect(
      tabBarClearance({ width: 800, height: 600, fontScale: 1, bottomInset: 0, rail: false }),
    ).toBe(TAB_BAR_BESIDE_HEIGHT);
  });

  it('is only the inset beside the rail', () => {
    expect(
      tabBarClearance({ width: 1000, height: 700, fontScale: 1, bottomInset: 12, rail: true }),
    ).toBe(12);
  });
});
