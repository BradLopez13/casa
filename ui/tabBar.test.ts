import { describe, expect, it } from 'vitest';
import { TAB_LABEL_MAX_SCALE, tabBarHeight, tabLabelsBeside } from './tabBar';

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

  it('leaves the default bar alone at the default text size', () => {
    expect(tabBarHeight({ ...portrait, fontScale: 1 })).toBeUndefined();
    expect(tabBarHeight({ ...portrait, fontScale: 0.85 })).toBeUndefined();
  });

  it('grows with the label under the icon, keeping the bottom inset', () => {
    // MIUI's largest text: a 16 dp label line becomes 23.2, so the bar grows by 8.
    expect(tabBarHeight({ ...portrait, fontScale: 1.45 })).toBe(49 + 8 + 24);
    expect(tabBarHeight({ ...portrait, fontScale: 1.3, bottomInset: 0 })).toBe(49 + 5);
  });

  it('stops growing where the label stops: at the rail’s 1.6', () => {
    expect(TAB_LABEL_MAX_SCALE).toBe(1.6);
    expect(tabBarHeight({ ...portrait, fontScale: 2 })).toBe(
      tabBarHeight({ ...portrait, fontScale: 1.6 }),
    );
    expect(tabBarHeight({ ...portrait, fontScale: 1.6, bottomInset: 0 })).toBe(49 + 10);
  });

  it('leaves the bar alone when the labels sit beside the icons, where the row has room', () => {
    expect(tabBarHeight({ width: 915, height: 412, bottomInset: 0, fontScale: 1.45 })).toBe(
      undefined,
    );
  });
});
