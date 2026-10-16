import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { exchangeCodeOnce } from '@/features/auth/social/exchange';
import { callbackOutcome } from '@/features/auth/social/nonce';
import { t } from '@/i18n';
import { useTheme } from '@/ui/theme';

/**
 * Where the browser sign-in (Google on web, Apple on web) lands with a PKCE `code`. The route
 * guard keeps this screen up while the code is exchanged, then moves on once the session exists.
 */
export default function AuthCallback() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    const outcome = callbackOutcome(params);
    if (outcome.kind !== 'exchange') {
      // A cancellation is silent; anything else tells the sign-in screen to show an error.
      router.replace(
        outcome.kind === 'cancelled'
          ? '/sign-in'
          : { pathname: '/sign-in', params: { error: 'callback' } },
      );
      return;
    }
    // Shared and memoised per code: re-renders, or the Android browser flow that exchanges
    // the same link, never use the single-use code twice.
    exchangeCodeOnce(outcome.code).catch(() =>
      router.replace({ pathname: '/sign-in', params: { error: 'callback' } }),
    );
  }, [params, router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.page,
      }}
    >
      <ActivityIndicator color={colors.muted} accessibilityLabel={t('auth.callback.loading')} />
    </View>
  );
}
