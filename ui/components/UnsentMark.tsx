import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';
import { t } from '@/i18n';
import { useTheme } from '../theme';

/**
 * «Sin enviar» on anything that waits in the queue (bloque 13, P3-2): the crossed cloud and the
 * word, so it reads without knowing the icon, at any text size. The same on a task note, a done
 * note and a shopping row.
 */
export function UnsentMark({ testID }: { testID?: string }) {
  const { colors, space } = useTheme();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={t('shopping.pending')}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space(1) }}
    >
      <Ionicons name="cloud-offline-outline" size={14} color={colors.muted} accessible={false} />
      <Text style={{ color: colors.muted, fontSize: 14 }}>{t('shopping.pending')}</Text>
    </View>
  );
}
