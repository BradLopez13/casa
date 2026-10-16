import Svg, { Circle, G, Path } from 'react-native-svg';
import { NIDO_SYMBOL_PATHS, NIDO_SYMBOL_VIEWBOX, nidoSymbolColors } from '../nidoSymbol';
import { useTheme } from '../theme';

/** The Nido symbol: two figures sharing a hollow. Decorative. */
export function NidoSymbol({ size }: { size: number }) {
  const { scheme } = useTheme();
  const c = nidoSymbolColors(scheme);
  const { left, right } = NIDO_SYMBOL_PATHS;
  return (
    <Svg
      width={size}
      height={size}
      viewBox={NIDO_SYMBOL_VIEWBOX}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <G fill={c.left}>
        <Circle {...left.circle} />
        <Path d={left.path} />
      </G>
      <G fill={c.right}>
        <Circle {...right.circle} />
        <Path d={right.path} />
      </G>
    </Svg>
  );
}
