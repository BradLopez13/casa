import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '@/data/supabase/client';
import { callbackCode } from '@/features/auth/social/nonce';
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
  const done = useRef(false);

  useEffect(() => {
    // One exchange only: a code can be used once, and re-renders must not retry it.
    if (done.current) return;
    done.current = true;
    const code = callbackCode(params);
    if (!code) {
      router.replace('/sign-in');
      return;
    }
    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) router.replace('/sign-in');
      })
      .catch(() => router.replace('/sign-in'));
  }, [params, router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.muted} accessibilityLabel={t('members.loading')} />
    </View>
  );
}
