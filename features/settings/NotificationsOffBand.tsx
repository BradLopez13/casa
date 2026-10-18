import { Linking, Text, View } from 'react-native';
import { t } from '@/i18n';
import { actionIcons } from '@/ui/actionIcons';
import { Button } from '@/ui/components/Button';
import { useTheme } from '@/ui/theme';

/**
 * The one notice in Ajustes that the phone has notifications off, with the way to its settings.
 * Recordatorios and Avisos del hogar both depend on it, so it sits once, above them.
 */
export function NotificationsOffBand({ denied }: { denied: boolean }) {
  const { colors, radii, shadows, noteEdge, space } = useTheme();
  if (!denied) return null;
  return (
    <View
      style={{
        gap: space(3),
        padding: space(4),
        borderRadius: radii.note,
        backgroundColor: colors.note,
        ...shadows.note,
        ...noteEdge,
      }}
    >
      <Text
        testID="settings.notifications.denied"
        accessibilityLiveRegion="polite"
        style={{ color: colors.ink, fontSize: 14 }}
      >
        {t('settings.notificationsOff')}
      </Text>
      <Button
        testID="settings.notifications.open-settings"
        title={t('settings.openPhoneSettings')}
        variant="tertiary"
        icon={actionIcons.openPhoneSettings}
        width="hug"
        onPress={() => {
          Linking.openSettings().catch(() => undefined);
        }}
      />
    </View>
  );
}
