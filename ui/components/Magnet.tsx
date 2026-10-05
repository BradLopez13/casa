import { Platform, Pressable, Text, View } from 'react-native';
import type { MagnetColor } from '@/domain/members/marks';
import { useTheme } from '../theme';
import {
  displayFont,
  magnetInitialSizes,
  magnetSizes,
  MIN_TOUCH,
  type MagnetSize,
} from '../tokens';

type Props = {
  initial: string;
  color: MagnetColor;
  size: MagnetSize;
  /** 'empty' is the dashed circle used for an unassigned task. */
  variant?: 'filled' | 'empty';
  /** Pass a boolean when the magnet can be selected; true draws the cobalt ring. */
  selected?: boolean;
  accessibilityLabel: string;
  testID?: string;
  onPress?: () => void;
  /** Hide it from screen readers when the person's name is already read next to it. */
  decorative?: boolean;
};

const RING = 2;
const GAP = 3;

export function Magnet({
  initial,
  color,
  size,
  variant = 'filled',
  selected,
  accessibilityLabel,
  testID,
  onPress,
  decorative = false,
}: Props) {
  const { colors, shadows } = useTheme();
  const diameter = magnetSizes[size];
  const empty = variant === 'empty';
  // The chip-sized magnet sits inside a pill and stays flat.
  const depth = !empty && size !== 'sm' ? shadows.magnet : null;

  const disc = (
    <View
      style={{
        width: diameter,
        height: diameter,
        borderRadius: diameter / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: empty ? 'transparent' : colors.magnet[color],
        ...(empty ? { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.outline } : {}),
        ...depth,
      }}
    >
      {empty ? null : (
        <Text
          maxFontSizeMultiplier={1.2}
          style={{
            color: colors.magnetInk,
            fontFamily: displayFont,
            fontSize: magnetInitialSizes[size],
            lineHeight: Math.round(magnetInitialSizes[size] * 1.25),
            textAlign: 'center',
            ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
          }}
        >
          {initial}
        </Text>
      )}
    </View>
  );

  // A selectable magnet always reserves the ring's space, so selecting never shifts the row.
  const selectable = selected !== undefined;
  const ringed = selectable ? (
    <View
      style={{
        padding: GAP,
        borderWidth: RING,
        borderRadius: (diameter + 2 * (GAP + RING)) / 2,
        borderColor: selected ? colors.cobalt : 'transparent',
        backgroundColor: selected ? colors.door : 'transparent',
      }}
    >
      {disc}
    </View>
  ) : (
    disc
  );

  const outer = diameter + (selectable ? 2 * (GAP + RING) : 0);
  const slop = Math.max(0, Math.ceil((MIN_TOUCH - outer) / 2));

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        hitSlop={slop}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={selectable ? { selected } : undefined}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        {ringed}
      </Pressable>
    );
  }

  return (
    <View
      testID={testID}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : accessibilityLabel}
      accessibilityState={!decorative && selectable ? { selected } : undefined}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
    >
      {ringed}
    </View>
  );
}
