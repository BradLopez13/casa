import { describe, expect, it } from 'vitest';
import { buttonLook, pressedOpacity } from './buttonLook';
import { contrastRatio } from './contrast';
import { palettes, type Scheme } from './tokens';

describe.each<Scheme>(['light', 'dark'])('buttonLook (%s)', (scheme) => {
  const p = palettes[scheme];

  it('fills a primary button while it can be pressed', () => {
    expect(buttonLook('primary', 'enabled', p)).toEqual({
      fill: p.cobalt,
      border: p.cobalt,
      foreground: p.onCobalt,
    });
  });

  it('keeps the outlined variants as they are', () => {
    expect(buttonLook('secondary', 'enabled', p)).toEqual({
      fill: 'transparent',
      border: p.cobalt,
      foreground: p.cobalt,
    });
    expect(buttonLook('danger', 'enabled', p)).toEqual({
      fill: 'transparent',
      border: p.red,
      foreground: p.red,
    });
  });

  it.each(['primary', 'secondary', 'danger'] as const)(
    'draws a disabled %s as an empty outlined pill with quiet text',
    (variant) => {
      expect(buttonLook(variant, 'disabled', p)).toEqual({
        fill: 'transparent',
        border: p.outline,
        foreground: p.muted,
      });
    },
  );

  it('keeps the variant while busy, so the spinner sits on the same pill', () => {
    expect(buttonLook('primary', 'busy', p)).toEqual(buttonLook('primary', 'enabled', p));
  });

  it.each([p.page, p.door, p.note])('disabled text stays readable on %s', (ground) => {
    expect(contrastRatio(p.muted, ground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.mutedStrong, ground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.outline, ground)).toBeGreaterThanOrEqual(3);
  });
});

describe('pressedOpacity', () => {
  it('dims only a pressed button, never a disabled one', () => {
    expect(pressedOpacity(true)).toBeLessThan(1);
    expect(pressedOpacity(false)).toBe(1);
  });
});
