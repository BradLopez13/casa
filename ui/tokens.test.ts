import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import {
  CONTROL_HEIGHT,
  INLINE_PILL_HEIGHT,
  magnetSizes,
  MIN_TOUCH,
  noteEdges,
  palettes,
  radii,
  shadows,
} from './tokens';

describe('noteEdges', () => {
  it('gives dark notes a 1 dp hairline edge, where the shadow is lost on navy', () => {
    expect(noteEdges.dark).toEqual({ borderWidth: 1, borderColor: palettes.dark.hairline });
  });

  it('leaves light notes to their shadow', () => {
    expect(noteEdges.light.borderWidth).toBe(0);
  });
});

describe('control heights', () => {
  it('keeps fields, buttons and the New task pill above the touch minimum', () => {
    expect(CONTROL_HEIGHT).toBeGreaterThanOrEqual(MIN_TOUCH);
  });

  it('draws the inline pill inside a full touch target, never as one', () => {
    expect(INLINE_PILL_HEIGHT).toBeLessThan(MIN_TOUCH);
  });
});

describe('radii', () => {
  it('locks the radii to note, door and pill', () => {
    expect(Object.keys(radii)).toEqual(['note', 'door', 'pill']);
  });
});

describe('magnet material', () => {
  it('has a short contact shadow and a wide ambient one in both schemes', () => {
    expect(shadows.light.magnet.shadowOpacity).toBe(0.3);
    expect(shadows.light.magnet.shadowRadius).toBe(3);
    expect(shadows.light.magnetAmbient).toBeDefined();
    expect(shadows.dark.magnetAmbient).toBeDefined();
    expect(shadows.light.magnetAmbient.shadowRadius).toBe(10);
    expect(shadows.dark.magnetAmbient.shadowRadius).toBe(10);
  });
  it('has a top highlight colour in both palettes', () => {
    expect(palettes.light.magnetHighlight).toBe('rgba(255,255,255,0.28)');
    expect(palettes.dark.magnetHighlight).toBe('rgba(255,255,255,0.35)');
  });
});

describe('the fridge tab bar', () => {
  // Composites an `rgba(r,g,b,a)` token over an opaque hex ground, as the screen shows it.
  function over(rgba: string, ground: string): string {
    if (rgba.startsWith('#')) return rgba;
    const m = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(rgba);
    if (!m) throw new Error(`Not an rgba colour: ${rgba}`);
    const a = Number(m[4]);
    const g = [1, 3, 5].map((i) => parseInt(ground.slice(i, i + 2), 16));
    return `#${[1, 2, 3]
      .map((i, k) => Math.round(Number(m[i]) * a + (g[k] ?? 0) * (1 - a)))
      .map((c) => c.toString(16).padStart(2, '0'))
      .join('')}`;
  }

  it.each(['light', 'dark'] as const)('%s: every tab reads on the bar', (scheme) => {
    const p = palettes[scheme];
    expect(contrastRatio(p.onTabBar, p.tabBar)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(over(p.onTabBarMuted, p.tabBar), p.tabBar)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.onAccent, p.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it('light: the bar is the door enamel', () => {
    expect(palettes.light.tabBar).toBe(palettes.light.door);
  });

  it('holds the active tab in a 40 dp pósit', () => {
    expect(magnetSizes.tab).toBe(40);
  });
});
