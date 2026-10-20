// Pure: no react-native import, so Vitest can check it.
import { PRIMARY_EDGE, type Palette } from './tokens';

/**
 * The edge of a surface filled with the pósit: none while `accentEdge` is the pósit itself, the
 * slate edge of high contrast otherwise. Any other fill keeps its own edge.
 */
export function positEdge(
  fill: string,
  colors: Pick<Palette, 'accent' | 'accentEdge'>,
): { borderWidth: number; borderColor: string } | null {
  if (fill !== colors.accent || colors.accentEdge === colors.accent) return null;
  return { borderWidth: PRIMARY_EDGE, borderColor: colors.accentEdge };
}
