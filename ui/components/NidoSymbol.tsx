import { View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { NIDO_SYMBOL_PATHS, NIDO_SYMBOL_VIEWBOX, nidoSymbolColors } from '../nidoSymbol';
import { useTheme } from '../theme';
import { radii } from '../tokens';

const TILE_INSET = 8;

/** The Nido symbol: two figures sharing a hollow. Decorative. */
export function NidoSymbol({ size }: { size: number }) {
  const { scheme } = useTheme();
  const c = nidoSymbolColors(scheme);
  const { left, right } = NIDO_SYMBOL_PATHS;
  const inset = c.tile === null ? 0 : TILE_INSET;
  const symbol = (
    <Svg
      width={size - inset * 2}
      height={size - inset * 2}
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
  if (c.tile === null) return symbol;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        padding: inset,
        backgroundColor: c.tile,
        borderRadius: radii.note,
      }}
    >
      {symbol}
    </View>
  );
}
