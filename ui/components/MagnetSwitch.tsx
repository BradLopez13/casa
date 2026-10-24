import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useRef } from 'react';
import { Pressable, View, type SwitchProps } from 'react-native';
import { magnetSwitchLook } from '../magnetSwitchLook';
import { haptic } from '../motion';
import { useTheme } from '../theme';
import { magnetSizes, MIN_TOUCH } from '../tokens';
import { Magnet } from './Magnet';

const SIZE = magnetSizes.md;
const SLOP = Math.max(0, Math.ceil((MIN_TOUCH - SIZE) / 2));

type Props = Pick<SwitchProps, 'value' | 'disabled' | 'onValueChange' | 'testID'> & {
  /** What the switch turns on and off: required, a switch without it is only «on» or «off». */
  accessibilityLabel: string;
  /**
   * Asking the phone or saving: the switch keeps the look of its value and ignores taps. Not
   * `disabled`, which is paused (the phone has notifications off) and draws dashed.
   */
  busy?: boolean;
};

/**
 * A switch drawn as a magnet that sticks when it is on (fase 10f, `magnetSwitchLook`): the slate
 * magnet with a bell, with the magnet's material (shadow, ring and, in dark, its drawn drop), or
 * the bare ring with the crossed bell; dashed while paused. To a screen reader it is the system
 * switch: its role, its label and `aria-checked`. 44 dp to the touch through `hitSlop`. A tap is
 * the `light` buzz; the magnet sticking (on) is the `rigid` one.
 */
export function MagnetSwitch({
  value = false,
  disabled,
  busy = false,
  onValueChange,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const look = magnetSwitchLook(value, colors, !!disabled);
  // The `rigid` buzz when the magnet actually sticks (the value turns on), not on the tap: a phone
  // that refuses notifications leaves it off, and it must not have buzzed «stuck».
  const was = useRef(value);
  useEffect(() => {
    if (value && !was.current) void haptic('rigid');
    was.current = value;
  }, [value]);
  const glyph = (
    <MaterialCommunityIcons
      name={look.glyph}
      size={Math.round(SIZE * 0.5)}
      color={look.glyphColor}
      accessible={false}
      importantForAccessibility="no"
    />
  );
  return (
    <Pressable
      {...rest}
      accessibilityRole="switch"
      aria-checked={value}
      aria-disabled={!!disabled}
      aria-busy={busy}
      disabled={disabled || busy}
      hitSlop={SLOP}
      onPress={() => {
        void haptic('light');
        void onValueChange?.(!value);
      }}
    >
      {look.dashed ? (
        <View
          style={{
            width: SIZE,
            height: SIZE,
            borderRadius: SIZE / 2,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: look.edge,
            borderStyle: 'dashed',
          }}
        >
          {glyph}
        </View>
      ) : (
        <Magnet
          size="md"
          variant={look.raised ? 'filled' : 'empty'}
          decorative
          initial=""
          color="teal"
          accessibilityLabel=""
          glyph={{ node: glyph, fill: look.fill }}
        />
      )}
    </Pressable>
  );
}
