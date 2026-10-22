import { describe, expect, it } from 'vitest';
import { doorEdge, positEdge } from './positEdge';
import { highContrast, palettes } from './tokens';

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

describe('doorEdge', () => {
  const light = { ...palettes.light };
  const strong = { ...palettes.light, ...highContrast.light };
  const dark = { ...palettes.dark, ...highContrast.dark };

  it('draws no edge on the door by default: the enamel is a decision (Identidad, fase 5)', () => {
    expect(doorEdge(light)).toBeNull();
  });

  it('with high contrast in light, the door takes an outline edge (fase 10a)', () => {
    expect(doorEdge(strong)).toEqual({ width: 1.5, color: palettes.light.outline });
  });

  it('in dark the door is already apart from the slate page', () => {
    expect(doorEdge(dark)).toBeNull();
  });
});
