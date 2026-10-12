import { describe, expect, it } from 'vitest';
import { newTaskListPadding, newTaskPlacement } from './newTaskPlacement';

const phone = { right: 0, bottom: 34 };

describe('newTaskPlacement', () => {
  it('leaves the bottom inset to the tab bar when there is no rail', () => {
    expect(newTaskPlacement({ insets: phone, rail: false, edge: 16 })).toEqual({
      right: 16,
      bottom: 16,
    });
  });

  it('clears the bottom inset itself with the rail', () => {
    expect(newTaskPlacement({ insets: phone, rail: true, edge: 16 })).toEqual({
      right: 16,
      bottom: 50,
    });
  });

  it('clears a side notch in landscape', () => {
    const insets = { right: 47, bottom: 21 };
    expect(newTaskPlacement({ insets, rail: false, edge: 16 }).right).toBe(63);
    expect(newTaskPlacement({ insets, rail: true, edge: 16 }).right).toBe(63);
  });
});

describe('newTaskListPadding', () => {
  it('keeps the current 92 dp under the list with the tab bar', () => {
    const placement = newTaskPlacement({ insets: phone, rail: false, edge: 16 });
    expect(newTaskListPadding({ placement, buttonHeight: 48, clearance: 28 })).toBe(92);
  });

  it('always reaches past the top of the pill', () => {
    for (const rail of [false, true]) {
      const placement = newTaskPlacement({ insets: phone, rail, edge: 16 });
      const padding = newTaskListPadding({ placement, buttonHeight: 48, clearance: 28 });
      expect(padding).toBeGreaterThan(placement.bottom + 48);
    }
  });
});
