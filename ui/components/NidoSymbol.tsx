import { View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { NIDO_SYMBOL_PATHS, NIDO_SYMBOL_VIEWBOX, nidoSymbolColors } from '../nidoSymbol';
import { useTheme } from '../theme';
import { radii } from '../tokens';

const TILE_INSET = 8;

/**
 * The Nido symbol: two figures sharing a hollow. Decorative. `onSlate` drops the slate tile for
 * use on the brand band; `mono` draws both figures in that one colour, with no tile and the mono seam between the bases.
 */
export function NidoSymbol({
  size,
  onSlate = false,
  mono,
}: {
  size: number;
  onSlate?: boolean;
  mono?: string;
}) {
  const { scheme } = useTheme();
  const brand = nidoSymbolColors(scheme);
  const c = mono === undefined ? brand : { left: mono, right: mono, tile: null };
  const { left, right } = NIDO_SYMBOL_PATHS;
  // On the brand band the slate is already behind it: no tile of its own.
  const tile = onSlate ? null : c.tile;
  const inset = tile === null ? 0 : TILE_INSET;
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
        <Path d={mono === undefined ? left.path : left.monoPath} />
      </G>
      <G fill={c.right}>
        <Circle {...right.circle} />
        <Path d={mono === undefined ? right.path : right.monoPath} />
      </G>
    </Svg>
  );
  if (tile === null) return symbol;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        padding: inset,
        backgroundColor: tile,
        borderRadius: radii.note,
      }}
    >
      {symbol}
    </View>
  );
}
