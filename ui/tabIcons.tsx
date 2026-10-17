import type { ReactNode } from 'react';
import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

export type TabIconProps = { color: ColorValue; size: number };

/**
 * The frame every tab icon shares: a 24 grid and a 2.2 stroke with round caps and joins, so the
 * four read as one family and sit with M PLUS Rounded. Decorative: the tab carries the name.
 */
function Icon({ color, size, children }: TabIconProps & { children: ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {children}
    </Svg>
  );
}

/** Hoy. */
export function SunIcon(props: TabIconProps) {
  return (
    <Icon {...props}>
      <Circle cx={12} cy={12} r={4} />
      <Path d="M12 2.5v1.8M12 19.7v1.8M2.5 12h1.8M19.7 12h1.8M5.3 5.3l1.3 1.3M17.4 17.4l1.3 1.3M5.3 18.7l1.3-1.3M17.4 6.6l1.3-1.3" />
    </Icon>
  );
}

/** Tareas: three lines, each with its dot. */
export function ListIcon(props: TabIconProps) {
  return (
    <Icon {...props}>
      <Path d="M9 6h11M9 12h11M9 18h11" />
      <Path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
    </Icon>
  );
}

/** Compra: a basket with its two handles. */
export function BasketIcon(props: TabIconProps) {
  return (
    <Icon {...props}>
      <Path d="M7.5 10 10.5 4M16.5 10 13.5 4" />
      <Path d="M3 10h18l-1.7 8.3a2 2 0 0 1-2 1.7H6.7a2 2 0 0 1-2-1.7L3 10Z" />
      <Path d="M10 13.5v3M14 13.5v3" />
    </Icon>
  );
}

/** Ajustes: a cog (outline after Lucide's «settings», ISC). */
export function GearIcon(props: TabIconProps) {
  return (
    <Icon {...props}>
      <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
      <Circle cx={12} cy={12} r={3} />
    </Icon>
  );
}
