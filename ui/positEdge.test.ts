import { describe, expect, it } from 'vitest';
import { positEdge } from './positEdge';
import { palettes } from './tokens';

const { accent } = palettes.light;

describe('positEdge', () => {
  it('draws no edge while accentEdge is the pósit itself', () => {
    expect(positEdge(accent, { accent, accentEdge: accent })).toBeNull();
  });

  it('edges a pósit fill with accentEdge when they differ', () => {
    expect(positEdge(accent, { accent, accentEdge: '#2E3B41' })).toEqual({
      borderWidth: 1.5,
      borderColor: '#2E3B41',
    });
  });

  it('leaves any other fill alone', () => {
    expect(positEdge('#579488', { accent, accentEdge: '#2E3B41' })).toBeNull();
  });
});
