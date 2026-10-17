import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '@/ui/theme';
import { CONTROL_HEIGHT } from '@/ui/tokens';

type Props = { busy: boolean; disabled: boolean; dimmed: boolean; onPress: () => void };

/** Apple's own button, shown only once the device says Sign in with Apple is available. */
export function AppleButton({ busy, disabled, dimmed, onPress }: Props) {
  const { scheme, radii, colors } = useTheme();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let alive = true;
    AppleAuthentication.isAvailableAsync()
      .then((ok) => {
        if (alive) setAvailable(ok);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (!available) return null;
  return (
    <View
      testID="auth-apple"
      pointerEvents={disabled ? 'none' : 'auto'}
      // Apple's guidelines dictate this dimmed state, so it keeps the opacity.
      style={{ opacity: dimmed ? 0.5 : 1 }}
    >
      {busy ? (
        <View style={{ height: CONTROL_HEIGHT, justifyContent: 'center' }}>
          <ActivityIndicator color={colors.muted} />
        </View>
      ) : (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={
            scheme === 'dark'
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={radii.pill}
          style={{ height: CONTROL_HEIGHT, width: '100%' }}
          onPress={onPress}
        />
      )}
    </View>
  );
}
