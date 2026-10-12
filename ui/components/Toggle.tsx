import { Switch, type SwitchProps } from 'react-native';
import { useTheme } from '../theme';

/**
 * A switch in the Nido colours. Android paints the thumb with the system accent unless told
 * otherwise; here it follows the pill it sits on: onCobalt over the action colour when on, the
 * card colour over the outline when off.
 */
export function Toggle(
  props: Omit<SwitchProps, 'trackColor' | 'thumbColor' | 'ios_backgroundColor'>,
) {
  const { colors } = useTheme();
  return (
    <Switch
      {...props}
      trackColor={{ true: colors.cobalt, false: colors.outline }}
      thumbColor={props.value ? colors.onCobalt : colors.note}
      ios_backgroundColor={colors.outline}
    />
  );
}
