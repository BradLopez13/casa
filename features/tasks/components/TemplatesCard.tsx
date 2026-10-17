import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { t } from '@/i18n';
import { actionIcons } from '@/ui/actionIcons';
import { Button } from '@/ui/components/Button';
import { useTheme } from '@/ui/theme';
import { displayFontBold } from '@/ui/tokens';

/** A plain note (no magnet: it is nobody's task) inviting an empty household to start from templates. */
export function TemplatesCard() {
  const { colors, radii, shadows, noteEdge, space } = useTheme();
  const router = useRouter();
  return (
    <View
      style={{
        gap: space(4),
        padding: space(5),
        backgroundColor: colors.note,
        borderRadius: radii.note,
        ...shadows.note,
        ...noteEdge,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{ color: colors.ink, fontFamily: displayFontBold, fontSize: 15 }}
      >
        {t('templates.cardTitle')}
      </Text>
      <Button
        testID="today.templates"
        title={t('templates.cardAction')}
        icon={actionIcons.templates}
        variant="secondary"
        onPress={() => router.push('/templates')}
      />
    </View>
  );
}
