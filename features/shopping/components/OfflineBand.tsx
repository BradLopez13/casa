import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { t } from '@/i18n';
import { FADE_MS } from '@/ui/motion';
import { useTheme } from '@/ui/theme';

/** A thin band under the door while the phone has no connection. */
export function OfflineBand() {
  const { colors, space } = useTheme();
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(t('shopping.offline'));
  }, []);
  return (
    <Animated.View entering={FadeIn.duration(FADE_MS)} exiting={FadeOut.duration(FADE_MS)}>
      <View
        testID="shopping.offline"
        accessible
        accessibilityLabel={t('shopping.offline')}
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
          {t('shopping.offline')}
        </Text>
      </View>
    </Animated.View>
  );
}
