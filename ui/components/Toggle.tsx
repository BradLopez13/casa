import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View, type SwitchProps } from 'react-native';
import { actionIcons } from '../actionIcons';
import { useTheme } from '../theme';
import { MIN_TOUCH } from '../tokens';
import { toggleLook } from '../toggleLook';

const WIDTH = 52;
const HEIGHT = 32;
const THUMB = 22;
const EDGE = 2;
const GAP = (HEIGHT - 2 * EDGE - THUMB) / 2;
const SLOP_Y = Math.max(0, Math.ceil((MIN_TOUCH - HEIGHT) / 2));
const SLOP_X = Math.max(0, Math.ceil((MIN_TOUCH - WIDTH) / 2));

type Props = Pick<
  SwitchProps,
  'value' | 'disabled' | 'onValueChange' | 'testID' | 'accessibilityLabel'
> & {
  /** The colour the switch is drawn on: the page (default) or a note. */
  surface?: string;
};

/**
 * A switch in the Nido colours (`toggleLook`): a bordered track, a bordered thumb and a check
 * on the thumb when on, so state reads by fill, edge and mark in both themes. The check is
 * decorative; the state is announced through accessibilityState.
 */
export function Toggle({ value = false, disabled, onValueChange, surface, ...rest }: Props) {
  const { colors } = useTheme();
  const look = toggleLook(value, colors, surface ?? colors.page);
  return (
    <Pressable
      {...rest}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      hitSlop={{ top: SLOP_Y, bottom: SLOP_Y, left: SLOP_X, right: SLOP_X }}
      onPress={() => void onValueChange?.(!value)}
      style={{
        width: WIDTH,
        height: HEIGHT,
        borderRadius: HEIGHT / 2,
        borderWidth: EDGE,
        borderColor: look.trackBorder,
        backgroundColor: look.track,
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: THUMB,
          height: THUMB,
          borderRadius: THUMB / 2,
          borderWidth: EDGE,
          borderColor: look.thumbBorder,
          backgroundColor: look.thumb,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: value ? WIDTH - 2 * EDGE - THUMB - GAP : GAP,
        }}
      >
        {look.check ? (
          <Ionicons
            accessible={false}
            name={actionIcons.confirm}
            size={12}
            color={colors.selection}
          />
        ) : null}
      </View>
    </Pressable>
  );
}
