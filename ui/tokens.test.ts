import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import {
  CONTROL_HEIGHT,
  INLINE_PILL_HEIGHT,
  magnetSizes,
  MIN_TOUCH,
  noteEdges,
  highContrast,
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

describe('selection is chalk or slate, never the pósit', () => {
  it.each(['light', 'dark'] as const)('%s: selection is not the pósit', (scheme) => {
    expect(palettes[scheme].selection).not.toBe(palettes[scheme].accent);
  });

  it.each(['light', 'dark'] as const)('%s: selection reads on door, page and note', (scheme) => {
    const p = palettes[scheme];
    for (const g of [p.door, p.page, p.note]) {
      expect(contrastRatio(p.selection, g)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('highContrast', () => {
  const hc = { ...palettes.light, ...highContrast.light };

  // §36: with the system's high contrast, the pósit gets a slate edge where it sits on paper.
  it('edges the pósit in slate on every light ground', () => {
    for (const g of [hc.page, hc.note, hc.taskNote, hc.door]) {
      expect(contrastRatio(hc.accentEdge, g)).toBeGreaterThanOrEqual(3);
    }
  });

  it('swaps muted for its stronger tone in both themes', () => {
    expect(highContrast.light.muted).toBe(palettes.light.mutedStrong);
    expect(highContrast.dark.muted).toBe(palettes.dark.mutedStrong);
    expect(contrastRatio(hc.muted, hc.page)).toBeGreaterThanOrEqual(4.5);
  });

  it('leaves the pósit edge alone in dark, where the pósit already stands out on slate', () => {
    expect(highContrast.dark.accentEdge).toBeUndefined();
  });
});

describe('identidad secundaria (fase 10f)', () => {
  it('gives the magnets a drawn drop and an inner ring in dark only', () => {
    expect(palettes.light.magnetDrop).toBe('transparent');
    expect(palettes.dark.magnetDrop).toBe('rgba(8,12,14,0.75)');
    expect(palettes.dark.magnetRing).toBe('rgba(8,12,14,0.45)');
  });

  it('rules the shopping note with a line that shows on the pósit paper', () => {
    expect(palettes.light.rule).toBe('rgba(46,59,65,0.13)');
    expect(palettes.dark.rule).toBe(palettes.dark.hairline);
  });
});
