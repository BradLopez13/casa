import { describe, expect, it } from 'vitest';
import { buttonLook, buttonMetrics, DISABLED_LABEL_OPACITY, pressedOpacity } from './buttonLook';
import { contrastRatio, mixOver } from './contrast';
import { palettes, type Scheme } from './tokens';

describe.each<Scheme>(['light', 'dark'])('buttonLook (%s)', (scheme) => {
  const p = palettes[scheme];

  it('draws a primary button as the pósit with no visible edge', () => {
    const expected = {
      fill: p.accent,
      border: p.accent,
      foreground: p.onAccent,
      labelOpacity: 1,
    };
    expect(buttonLook('primary', 'default', 'enabled', p)).toEqual(expected);
    expect(buttonLook('primary', 'default', 'busy', p)).toEqual(expected);
  });

  it('fills a destructive primary button with red', () => {
    expect(buttonLook('primary', 'destructive', 'enabled', p)).toEqual({
      fill: p.red,
      border: p.red,
      foreground: p.onRed,
      labelOpacity: 1,
    });
  });

  it('draws an outlined button as an empty pill with a slate or chalk edge', () => {
    const expected = {
      fill: 'transparent',
      border: p.selection,
      foreground: p.ink,
      labelOpacity: 1,
    };
    expect(buttonLook('outlined', 'default', 'enabled', p)).toEqual(expected);
    expect(buttonLook('outlined', 'default', 'busy', p)).toEqual(expected);
    // On a task note its edge must read as a control, never as a disabled pill (3:1).
    expect(contrastRatio(p.selection, p.taskNote)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(p.ink, p.taskNote)).toBeGreaterThanOrEqual(4.5);
  });

  it('disables an outlined button like a primary one', () => {
    expect(buttonLook('outlined', 'default', 'disabled', p)).toEqual(
      buttonLook('primary', 'default', 'disabled', p),
    );
  });

  it('never makes an outlined button destructive', () => {
    expect(() => buttonLook('outlined', 'destructive', 'enabled', p)).toThrow();
  });

  it('draws a tertiary button as bare text', () => {
    expect(buttonLook('tertiary', 'default', 'enabled', p)).toEqual({
      fill: 'transparent',
      border: 'transparent',
      foreground: p.cobalt,
      labelOpacity: 1,
    });
    expect(buttonLook('tertiary', 'destructive', 'enabled', p)).toEqual({
      fill: 'transparent',
      border: 'transparent',
      foreground: p.red,
      labelOpacity: 1,
    });
  });

  it.each(['primary', 'outlined'] as const)(
    'draws a disabled %s as an empty pill with a solid edge and a faded label',
    (variant) => {
      // Dashed means paused (a switch the phone turned off), never disabled.
      expect(buttonLook(variant, 'default', 'disabled', p)).toEqual({
        fill: 'transparent',
        border: p.outline,
        foreground: p.ink,
        labelOpacity: DISABLED_LABEL_OPACITY,
      });
    },
  );

  it('draws a disabled tertiary button as faded text with no border', () => {
    expect(buttonLook('tertiary', 'default', 'disabled', p)).toEqual({
      fill: 'transparent',
      border: 'transparent',
      foreground: p.ink,
      labelOpacity: DISABLED_LABEL_OPACITY,
    });
  });

  it.each(['primary', 'outlined', 'tertiary'] as const)(
    'keeps the look of enabled while a %s is busy',
    (variant) => {
      expect(buttonLook(variant, 'default', 'busy', p)).toEqual(
        buttonLook(variant, 'default', 'enabled', p),
      );
    },
  );

  it.each([p.page, p.door, p.note])('disabled text stays readable on %s', (ground) => {
    // The faded label, as it lands on the ground, still reads.
    const label = mixOver(p.ink, ground, DISABLED_LABEL_OPACITY);
    expect(contrastRatio(label, ground)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(p.outline, ground)).toBeGreaterThanOrEqual(3);
  });
});

describe('buttonMetrics', () => {
  it('underlines only the tertiary label', () => {
    expect(buttonMetrics('tertiary').underline).toBe(true);
    expect(buttonMetrics('primary').underline).toBe(false);
    expect(buttonMetrics('outlined').underline).toBe(false);
  });

  it('sizes each level', () => {
    expect(buttonMetrics('primary')).toEqual({
      minHeight: 48,
      fontSize: 16,
      paddingV: 12,
      paddingH: 24,
      iconSize: 20,
      underline: false,
    });
    expect(buttonMetrics('outlined')).toEqual({
      minHeight: 44,
      fontSize: 15,
      paddingV: 10,
      paddingH: 20,
      iconSize: 20,
      underline: false,
    });
    expect(buttonMetrics('tertiary')).toEqual({
      minHeight: 44,
      fontSize: 15,
      paddingV: 8,
      paddingH: 12,
      iconSize: 18,
      underline: true,
    });
  });
});

describe('pressedOpacity', () => {
  it('dims only a pressed button, never a disabled one', () => {
    expect(pressedOpacity(true)).toBeLessThan(1);
    expect(pressedOpacity(false)).toBe(1);
  });
});

describe('buttonLook with high contrast', () => {
  const colors = { ...palettes.light, accentEdge: '#2E3B41' };

  it('edges the primary with accentEdge', () => {
    expect(buttonLook('primary', 'default', 'enabled', colors).border).toBe('#2E3B41');
    expect(buttonLook('primary', 'default', 'busy', colors).border).toBe('#2E3B41');
  });

  it('keeps the destructive and the disabled edges', () => {
    expect(buttonLook('primary', 'destructive', 'enabled', colors).border).toBe(colors.red);
    expect(buttonLook('primary', 'default', 'disabled', colors).border).toBe(colors.outline);
  });
});
