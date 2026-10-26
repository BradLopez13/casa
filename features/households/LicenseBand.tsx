import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { t } from '@/i18n';
import { announce } from '@/ui/a11y';
import { pressedOpacity } from '@/ui/buttonLook';
import { useTheme } from '@/ui/theme';
import { licenseBandText } from './billing';
import { useMembership } from './queries';

/**
 * Under the door of Hoy, Tareas and Compra when the household's licence has ended (bloque 12):
 * the same thin band as `OfflineBand`, with «Ver» to the licence screen. Only with billing on,
 * and only once the licence stops letting the household write: reading never changes.
 */
export function LicenseBand() {
  const { colors, space } = useTheme();
  const router = useRouter();
  const text = licenseBandText(useMembership().data?.license);
  useEffect(() => {
    if (text) announce(text);
  }, [text]);
  if (!text) return null;
  return (
    <View
      testID="license.band"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        columnGap: space(2),
        paddingVertical: space(2),
        paddingHorizontal: space(5),
      }}
    >
      <Ionicons name="key-outline" size={16} color={colors.muted} accessible={false} />
      <Text style={{ flexShrink: 1, color: colors.muted, fontSize: 14, fontWeight: '600' }}>
        {text}
      </Text>
      <Pressable
        testID="license.band.open"
        accessibilityRole="link"
        accessibilityLabel={`${t('license.bandAction')}: ${t('households.license')}`}
        hitSlop={12}
        onPress={() => router.push('/household/license')}
        style={({ pressed }) => ({ opacity: pressedOpacity(pressed) })}
      >
        <Text style={{ color: colors.ink, fontSize: 14, textDecorationLine: 'underline' }}>
          {t('license.bandAction')}
        </Text>
      </Pressable>
    </View>
  );
}
