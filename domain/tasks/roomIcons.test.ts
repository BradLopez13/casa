import glyphs from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';
import { describe, expect, it } from 'vitest';
import { CATALOG_ROOMS } from './catalog';
import { roomIcon } from './roomIcons';

describe('roomIcon', () => {
  it('gives every room of the catalogue a glyph the icon set has', () => {
    for (const room of CATALOG_ROOMS) expect(glyphs).toHaveProperty(roomIcon(room));
  });

  it('draws each room differently', () => {
    const icons = CATALOG_ROOMS.map(roomIcon);
    expect(new Set(icons).size).toBe(icons.length);
  });
});
