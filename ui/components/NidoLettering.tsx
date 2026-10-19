import Svg, { Circle, G, Path } from 'react-native-svg';
import {
  NIDO_LETTERING_DOT,
  NIDO_LETTERING_PATH,
  NIDO_LETTERING_VIEWBOX,
  letteringWidth,
} from '../nidoLettering';

/** The «nido» lettering, `height` dp tall, in one colour (chalk on the brand band). Decorative: the group around it carries the name. */
export function NidoLettering({ height, color }: { height: number; color: string }) {
  return (
    <Svg
      width={letteringWidth(height)}
      height={height}
      viewBox={NIDO_LETTERING_VIEWBOX}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <G fill={color}>
        <Path d={NIDO_LETTERING_PATH} />
        <Circle {...NIDO_LETTERING_DOT} />
      </G>
    </Svg>
  );
}
