import { describe, expect, it } from 'vitest';
import { noteEdges, palettes } from './tokens';

describe('noteEdges', () => {
  it('gives dark notes a 1 dp hairline edge, where the shadow is lost on navy', () => {
    expect(noteEdges.dark).toEqual({ borderWidth: 1, borderColor: palettes.dark.hairline });
  });

  it('leaves light notes to their shadow', () => {
    expect(noteEdges.light.borderWidth).toBe(0);
  });
});
