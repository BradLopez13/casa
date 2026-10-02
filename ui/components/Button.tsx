import { ActivityIndicator, Pressable, Text } from 'react-native';
import { useTheme } from '../theme';

type Props = {
  title: string;
  onPress: () => void;
  testID?: string;
  loading?: boolean;
  disabled?: boolean;
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
  const { colors, space } = useTheme();
  const inactive = disabled || loading;
  const filled = variant !== 'secondary';
  const background = variant === 'danger' ? colors.danger : colors.primary;
  const foreground = filled ? colors.bg : colors.primary;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={{
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: space(4),
        borderRadius: space(2),
        borderWidth: 1,
        borderColor: filled ? background : colors.border,
        backgroundColor: filled ? background : 'transparent',
        opacity: inactive ? 0.6 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <Text style={{ color: foreground, fontSize: 16, fontWeight: '600' }}>{title}</Text>
      )}
    </Pressable>
  );
}
