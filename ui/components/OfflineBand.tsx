import Ionicons from '@expo/vector-icons/Ionicons';
import { onlineManager } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { t } from '@/i18n';
import { announce } from '@/ui/a11y';
import { FADE_MS } from '@/ui/motion';
import { useReduceMotion, useTheme } from '@/ui/theme';

/** Several screens can show the band at once (the tabs stay mounted): one «back» is enough. */
const BACK_WINDOW_MS = 2000;
let backAnnouncedAt = -Infinity;

function announceBack() {
  const now = Date.now();
  if (now - backAnnouncedAt < BACK_WINDOW_MS) return;
  backAnnouncedAt = now;
  announce(t('offline.back'));
}

/**
 * A thin band under the door while the phone has no connection. `label` says what that means on
 * the screen (Compra still adds offline; Hoy and Tareas only show what they had). When it goes
 * because the connection came back, the screen reader hears so; with reduce motion it comes and
 * goes without a fade.
 */
export function OfflineBand({
  label = t('shopping.offline'),
  testID = 'shopping.offline',
}: {
  label?: string;
  testID?: string;
}) {
  const { colors, space } = useTheme();
  const reduceMotion = useReduceMotion();
  useEffect(() => {
    announce(label);
    return () => {
      // Gone while still offline means the screen was left: nothing came back.
      if (onlineManager.isOnline()) announceBack();
    };
  }, [label]);
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(FADE_MS)}
      exiting={reduceMotion ? undefined : FadeOut.duration(FADE_MS)}
    >
      <View
        testID={testID}
        accessible
        accessibilityLabel={label}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space(2),
          paddingVertical: space(2),
          paddingHorizontal: space(5),
        }}
      >
        <Ionicons name="cloud-offline-outline" size={16} color={colors.muted} />
        <Text style={{ flexShrink: 1, color: colors.muted, fontSize: 14, fontWeight: '600' }}>
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}
