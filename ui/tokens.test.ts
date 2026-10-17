import { describe, expect, it } from 'vitest';
import {
  CONTROL_HEIGHT,
  INLINE_PILL_HEIGHT,
  MIN_TOUCH,
  noteEdges,
  palettes,
  radii,
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
