import { describe, expect, it } from 'vitest';
import {
  CONTROL_HEIGHT,
  INLINE_PILL_HEIGHT,
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
