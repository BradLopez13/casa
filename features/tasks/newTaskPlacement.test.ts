import { describe, expect, it } from 'vitest';
import {
  newTaskLane,
  newTaskListPadding,
  newTaskPlacement,
  newTaskShape,
} from './newTaskPlacement';

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

describe('newTaskShape', () => {
  it('keeps the extended pill with its label on a tall window', () => {
    expect(newTaskShape({ shortHeight: false, pillHeight: 48 })).toEqual({
      iconOnly: false,
      height: 48,
    });
  });

  it('turns into a round icon-only button of at least 56 dp on a short window', () => {
    const shape = newTaskShape({ shortHeight: true, pillHeight: 48 });
    expect(shape.iconOnly).toBe(true);
    expect(shape.height).toBeGreaterThanOrEqual(56);
  });

  it('leaves the list room for the round button too', () => {
    const placement = newTaskPlacement({ insets: phone, rail: false, edge: 16 });
    const { height } = newTaskShape({ shortHeight: true, pillHeight: 48 });
    const padding = newTaskListPadding({ placement, buttonHeight: height, clearance: 28 });
    expect(padding).toBeGreaterThan(placement.bottom + height);
  });
});

describe('newTaskLane', () => {
  it('reserves nothing beside the labelled pill', () => {
    const placement = newTaskPlacement({ insets: phone, rail: false, edge: 16 });
    const shape = newTaskShape({ shortHeight: false, pillHeight: 48 });
    expect(newTaskLane({ placement, shape, gap: 12 })).toBe(0);
  });

  it('reserves the round button, its offset and a gap on a short window', () => {
    const placement = newTaskPlacement({ insets: { right: 0, bottom: 0 }, rail: false, edge: 16 });
    const shape = newTaskShape({ shortHeight: true, pillHeight: 48 });
    expect(newTaskLane({ placement, shape, gap: 12 })).toBe(16 + 56 + 12);
  });

  it('widens with a side notch on the right', () => {
    const placement = newTaskPlacement({ insets: { right: 47, bottom: 0 }, rail: false, edge: 16 });
    const shape = newTaskShape({ shortHeight: true, pillHeight: 48 });
    expect(newTaskLane({ placement, shape, gap: 12 })).toBe(47 + 16 + 56 + 12);
  });
});
