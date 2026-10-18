import { useColorScheme } from 'react-native';
import { useHighContrast } from './a11y';
import {
  noteEdges,
  palettes,
  radii,
  shadows,
  type NoteEdge,
  type Palette,
  type Scheme,
  type Shadow,
} from './tokens';

export { useReduceMotion } from './a11y';

export type Colors = Palette;

export function space(n: number): number {
  return n * 4;
}

export type Theme = {
  scheme: Scheme;
  colors: Colors;
  shadows: { magnet: Shadow; magnetAmbient: Shadow; note: Shadow; primary: Shadow };
  /** Spread on every note surface next to `shadows.note`: a hairline edge in dark mode only. */
  noteEdge: NoteEdge;
  radii: typeof radii;
  space: (n: number) => number;
};

export function useTheme(): Theme {
  const scheme: Scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const strong = useHighContrast();
  const base = palettes[scheme];
  const colors = strong ? { ...base, muted: base.mutedStrong } : base;
  return { scheme, colors, shadows: shadows[scheme], noteEdge: noteEdges[scheme], radii, space };
}
