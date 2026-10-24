import { ActivityIndicator, Pressable, Text } from 'react-native';
import { t } from '@/i18n';
import { pressedOpacity } from '@/ui/buttonLook';
import { useTheme } from '@/ui/theme';
import { CONTROL_HEIGHT } from '@/ui/tokens';
import { AppleMark } from './AppleMark';

const LOOK = {
  light: { fill: '#000000', text: '#FFFFFF' },
  dark: { fill: '#FFFFFF', text: '#000000' },
} as const;

type Props = { busy: boolean; disabled: boolean; dimmed: boolean; onPress: () => void };

/** Custom Apple button for Android and web (iOS uses the native one in AppleButton.ios.tsx). */
export function AppleButton({ busy, disabled, dimmed, onPress }: Props) {
  const { scheme, radii, space } = useTheme();
  const look = LOOK[scheme];
  return (
    <Pressable
      testID="auth-apple"
      accessibilityRole="button"
      accessibilityLabel={t('auth.social.apple')}
      aria-disabled={disabled}
      aria-busy={busy}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: CONTROL_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space(3),
        paddingHorizontal: space(5),
        borderRadius: radii.pill,
        backgroundColor: look.fill,
        // Apple's guidelines dictate this dimmed state, so it keeps the opacity.
        opacity: dimmed ? 0.5 : pressedOpacity(pressed),
      })}
    >
      {busy ? (
        <ActivityIndicator color={look.text} />
      ) : (
        <>
          <AppleMark color={look.text} />
          <Text style={{ color: look.text, fontSize: 17, fontWeight: '600' }}>
            {t('auth.social.apple')}
          </Text>
        </>
      )}
    </Pressable>
  );
}
