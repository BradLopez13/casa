import { Platform, Switch, type SwitchProps } from 'react-native';
import { useTheme } from '../theme';
import { toggleLook } from '../toggleLook';

/**
 * A switch in the Nido colours (`toggleLook`). Android paints the thumb with the system accent
 * unless told otherwise, so both parts are always set. The web's Switch reads the thumb of the
 * "on" state from `activeThumbColor` rather than `thumbColor`, and would otherwise paint it teal.
 */
export function Toggle(
  props: Omit<SwitchProps, 'trackColor' | 'thumbColor' | 'ios_backgroundColor'>,
) {
  const { colors } = useTheme();
  const on = toggleLook(true, colors);
  const off = toggleLook(false, colors);
  const web: object | null = Platform.OS === 'web' ? { activeThumbColor: on.thumb } : null;
  return (
    <Switch
      {...props}
      {...web}
      trackColor={{ true: on.track, false: off.track }}
      thumbColor={props.value ? on.thumb : off.thumb}
      ios_backgroundColor={off.track}
    />
  );
}
