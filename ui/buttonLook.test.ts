import { describe, expect, it } from 'vitest';
import { buttonLook, buttonMetrics, pressedOpacity } from './buttonLook';
import { contrastRatio } from './contrast';
import { palettes, type Scheme } from './tokens';

describe.each<Scheme>(['light', 'dark'])('buttonLook (%s)', (scheme) => {
  const p = palettes[scheme];

  it('fills a primary button while it can be pressed', () => {
    expect(buttonLook('primary', 'default', 'enabled', p)).toEqual({
      fill: p.cobalt,
      border: p.cobalt,
      foreground: p.onCobalt,
    });
  });

  it('fills a destructive primary button with red', () => {
    expect(buttonLook('primary', 'destructive', 'enabled', p)).toEqual({
      fill: p.red,
      border: p.red,
      foreground: p.onRed,
    });
  });

  it('draws a secondary button as a tonal pill', () => {
    expect(buttonLook('secondary', 'default', 'enabled', p)).toEqual({
      fill: p.tonal,
      border: p.tonal,
      foreground: p.cobalt,
    });
  });

  it('draws a tertiary button as bare text', () => {
    expect(buttonLook('tertiary', 'default', 'enabled', p)).toEqual({
      fill: 'transparent',
      border: 'transparent',
      foreground: p.cobalt,
    });
    expect(buttonLook('tertiary', 'destructive', 'enabled', p)).toEqual({
      fill: 'transparent',
      border: 'transparent',
      foreground: p.red,
    });
  });

  it.each(['primary', 'secondary'] as const)(
    'draws a disabled %s as an empty outlined pill with quiet text',
    (variant) => {
      expect(buttonLook(variant, 'default', 'disabled', p)).toEqual({
        fill: 'transparent',
        border: p.outline,
        foreground: p.muted,
      });
    },
  );

  it('draws a disabled tertiary button as quiet text with no border', () => {
    expect(buttonLook('tertiary', 'default', 'disabled', p)).toEqual({
      fill: 'transparent',
      border: 'transparent',
      foreground: p.muted,
    });
  });

  it.each(['primary', 'secondary', 'tertiary'] as const)(
    'keeps the look of enabled while a %s is busy',
    (variant) => {
      expect(buttonLook(variant, 'default', 'busy', p)).toEqual(
        buttonLook(variant, 'default', 'enabled', p),
      );
    },
  );

  it('refuses a destructive secondary button', () => {
    expect(() => buttonLook('secondary', 'destructive', 'enabled', p)).toThrow();
  });

  it.each([p.page, p.door, p.note])('disabled text stays readable on %s', (ground) => {
    expect(contrastRatio(p.muted, ground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.mutedStrong, ground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.outline, ground)).toBeGreaterThanOrEqual(3);
  });
});

describe('buttonMetrics', () => {
  it('sizes each level', () => {
    expect(buttonMetrics('primary')).toEqual({
      minHeight: 48,
      fontSize: 16,
      paddingV: 12,
      paddingH: 24,
      iconSize: 20,
    });
    expect(buttonMetrics('secondary')).toEqual({
      minHeight: 44,
      fontSize: 15,
      paddingV: 10,
      paddingH: 20,
      iconSize: 20,
    });
    expect(buttonMetrics('tertiary')).toEqual({
      minHeight: 44,
      fontSize: 15,
      paddingV: 8,
      paddingH: 12,
      iconSize: 18,
    });
  });
});

describe('pressedOpacity', () => {
  it('dims only a pressed button, never a disabled one', () => {
    expect(pressedOpacity(true)).toBeLessThan(1);
    expect(pressedOpacity(false)).toBe(1);
  });
});
