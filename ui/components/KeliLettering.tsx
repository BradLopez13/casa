import Svg, { Circle, G, Path } from 'react-native-svg';
import {
  KELI_LETTERING_DOT,
  KELI_LETTERING_PATH,
  KELI_LETTERING_VIEWBOX,
  letteringWidth,
} from '../keliLettering';

/** The «keli» lettering, `height` dp tall, in one colour (chalk on the brand band). Decorative: the group around it carries the name. */
export function KeliLettering({ height, color }: { height: number; color: string }) {
  return (
    <Svg
      width={letteringWidth(height)}
      height={height}
      viewBox={KELI_LETTERING_VIEWBOX}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <G fill={color}>
        <Path d={KELI_LETTERING_PATH} />
        <Circle {...KELI_LETTERING_DOT} />
      </G>
    </Svg>
  );
}
