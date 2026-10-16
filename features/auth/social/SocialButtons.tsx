import { lazy, Suspense, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { visibleAuthError } from '@/features/auth/form-errors';
import { t, type MessageKey } from '@/i18n';
import { ErrorText } from '@/ui/components/ErrorText';
import { useTheme } from '@/ui/theme';
import { CONTROL_HEIGHT } from '@/ui/tokens';
import { GoogleMark } from './GoogleMark';
import { enabledProviders } from './enabled';
import { toSocialFailure } from './failure';
import type { SocialProvider } from './providers';

// Lazy: on iOS the Apple button pulls in the native module, which should not load while Apple is off.
const AppleButton = lazy(() => import('./AppleButton').then((m) => ({ default: m.AppleButton })));

// Google's official button colours.
const GOOGLE_LOOK = {
  light: { fill: '#FFFFFF', text: '#1F1F1F', border: '#747775' },
  dark: { fill: '#131314', text: '#E3E3E3', border: '#8E918F' },
} as const;

export function SocialButtons() {
  const { scheme, colors, radii, space } = useTheme();
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);

  const inFlight = useRef(false);
  const providers = enabledProviders();
  if (providers.length === 0) return null;

  async function run(provider: SocialProvider, action: () => Promise<void>) {
    // State alone is too slow: two quick taps would both start a sign-in.
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setBusy(provider);
    try {
      await action();
      // The route guard moves on once the session changes.
    } catch (e) {
      setError(visibleAuthError(toSocialFailure(e).code));
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  const look = GOOGLE_LOOK[scheme];

  return (
    <View style={{ gap: space(3) }}>
      {providers.includes('google') ? (
        <Pressable
          testID="auth-google"
          accessibilityRole="button"
          accessibilityLabel={t('auth.social.google')}
          accessibilityState={{ disabled: busy !== null, busy: busy === 'google' }}
          disabled={busy !== null}
          onPress={() =>
            void run('google', async () => {
              // Lazy: Expo Go and Node never load the native module.
              const { signInWithGoogle } = await import('./google');
              await signInWithGoogle();
            })
          }
          style={({ pressed }) => ({
            minHeight: CONTROL_HEIGHT,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space(3),
            paddingHorizontal: space(5),
            borderRadius: radii.pill,
            borderWidth: 1,
            borderColor: look.border,
            backgroundColor: look.fill,
            opacity: busy !== null && busy !== 'google' ? 0.5 : pressed ? 0.85 : 1,
          })}
        >
          {busy === 'google' ? (
            <ActivityIndicator color={look.text} />
          ) : (
            <>
              <GoogleMark />
              <Text style={{ color: look.text, fontSize: 17, fontWeight: '600' }}>
                {t('auth.social.google')}
              </Text>
            </>
          )}
        </Pressable>
      ) : null}
      {providers.includes('apple') ? (
        <Suspense fallback={null}>
          <AppleButton
            busy={busy === 'apple'}
            disabled={busy !== null}
            dimmed={busy !== null && busy !== 'apple'}
            onPress={() =>
              void run('apple', async () => {
                // Lazy: the native module only loads when Apple is enabled and tapped.
                const { signInWithApple } = await import('./apple');
                await signInWithApple();
              })
            }
          />
        </Suspense>
      ) : null}
      {error ? <ErrorText>{t(error)}</ErrorText> : null}
      <Text style={{ color: colors.ink, fontSize: 15, textAlign: 'center' }}>
        {t('auth.social.or')}
      </Text>
    </View>
  );
}
