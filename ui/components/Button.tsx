import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme';

type Props = {
  title: string;
  onPress: () => void;
  testID?: string;
  loading?: boolean;
  disabled?: boolean;
  /** primary: cobalt pill. secondary: outlined pill. danger: ink pill for irreversible actions. */
  variant?: 'primary' | 'secondary' | 'danger';
};

export function Button({
  title,
  onPress,
  testID,
  loading = false,
  disabled = false,
  variant = 'primary',
}: Props) {
  const { colors, radii, space } = useTheme();
  const [focused, setFocused] = useState(false);
  const inactive = disabled || loading;
  const fill =
    variant === 'primary' ? colors.cobalt : variant === 'danger' ? colors.ink : 'transparent';
  const foreground =
    variant === 'primary' ? colors.onCobalt : variant === 'danger' ? colors.page : colors.cobalt;

  return (
    <View>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: inactive, busy: loading }}
        disabled={inactive}
        onPress={onPress}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={({ pressed }) => ({
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: space(5),
          paddingVertical: space(3),
          borderRadius: radii.pill,
          borderWidth: 1.5,
          borderColor: variant === 'secondary' ? colors.cobalt : fill,
          backgroundColor: fill,
          opacity: inactive ? 0.5 : pressed ? 0.8 : 1,
        })}
      >
        {loading ? (
          <ActivityIndicator color={foreground} />
        ) : (
          <Text style={{ color: foreground, fontSize: 17, fontWeight: '600', textAlign: 'center' }}>
            {title}
          </Text>
        )}
      </Pressable>
      {/* Keyboard focus ring, drawn outside the pill so the button keeps the field's width. */}
      {focused ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            bottom: -4,
            left: -4,
            borderRadius: radii.pill,
            borderWidth: 2,
            borderColor: colors.cobalt,
          }}
        />
      ) : null}
    </View>
  );
}
