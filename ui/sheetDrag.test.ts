import { describe, expect, it } from 'vitest';
import { dragOffset, shouldDismiss } from './sheetDrag';

describe('shouldDismiss', () => {
  it('closes past a quarter of the sheet, at least 120 dp', () => {
    expect(shouldDismiss({ translationY: 199, velocityY: 0, height: 800 })).toBe(false);
    expect(shouldDismiss({ translationY: 200, velocityY: 0, height: 800 })).toBe(true);
    expect(shouldDismiss({ translationY: 110, velocityY: 0, height: 300 })).toBe(false);
    expect(shouldDismiss({ translationY: 120, velocityY: 0, height: 300 })).toBe(true);
  });

  it('closes on a quick flick down, but not on a flick back up', () => {
    expect(shouldDismiss({ translationY: 40, velocityY: 1200, height: 800 })).toBe(true);
    expect(shouldDismiss({ translationY: 300, velocityY: -900, height: 800 })).toBe(false);
  });
});

describe('dragOffset', () => {
  it('follows the finger downwards only', () => {
    expect(dragOffset(80, false)).toBe(80);
    expect(dragOffset(-40, false)).toBe(0);
  });

  it('stays put with reduce motion: the gesture alone is enough', () => {
    expect(dragOffset(80, true)).toBe(0);
  });
});
