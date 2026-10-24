import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, View, type SwitchProps } from 'react-native';
import { magnetSwitchLook } from '../magnetSwitchLook';
import { haptic } from '../motion';
import { useTheme } from '../theme';
import { magnetSizes, MIN_TOUCH } from '../tokens';

const SIZE = magnetSizes.md;
const EDGE = 1.5;
const SLOP = Math.max(0, Math.ceil((MIN_TOUCH - SIZE) / 2));

type Props = Pick<SwitchProps, 'value' | 'disabled' | 'onValueChange' | 'testID'> & {
  /** What the switch turns on and off: required, a switch without it is only «on» or «off». */
  accessibilityLabel: string;
};

/**
 * A switch drawn as a magnet that sticks when it is on (fase 10f, `magnetSwitchLook`): the slate
 * magnet with a bell and its shadow, or the bare ring with the crossed bell; dashed while paused.
 * To a screen reader it is the system switch: its role, its label and `aria-checked`. 44 dp to
 * the touch through `hitSlop`. Sticking it on is the `rigid` buzz of putting a magnet up.
 */
export function MagnetSwitch({ value = false, disabled, onValueChange, ...rest }: Props) {
  const { colors, shadows } = useTheme();
  const look = magnetSwitchLook(value, colors, !!disabled);
  return (
    <Pressable
      {...rest}
      accessibilityRole="switch"
      aria-checked={value}
      aria-disabled={!!disabled}
      disabled={disabled}
      hitSlop={SLOP}
      onPress={() => {
        void haptic(value ? 'light' : 'rigid');
        void onValueChange?.(!value);
      }}
    >
      <View
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: look.fill,
          borderWidth: EDGE,
          borderColor: look.edge,
          borderStyle: look.dashed ? 'dashed' : 'solid',
          ...(look.raised ? shadows.magnet : null),
        }}
      >
        <MaterialCommunityIcons
          name={look.glyph}
          size={Math.round(SIZE * 0.5)}
          color={look.glyphColor}
          accessible={false}
          importantForAccessibility="no"
        />
      </View>
    </Pressable>
  );
}
