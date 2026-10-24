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

/**
 * The edge of the door and of the tab bar, its plinth. None by default: in light the enamel sits
 * at 1.32:1 on the paper by decision (DESIGN.md, Identidad). With the system's high contrast in
 * light (the one case where `accentEdge` is not the pósit) both take an `outline` edge, so the
 * door still reads as a door (fase 10a).
 */
export function doorEdge(
  colors: Pick<Palette, 'accent' | 'accentEdge' | 'outline'>,
): { width: number; color: string } | null {
  if (colors.accentEdge === colors.accent) return null;
  return { width: PRIMARY_EDGE, color: colors.outline };
}
