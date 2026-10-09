import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { useTheme } from '@/ui/theme';

/** A plain note (no magnet: it is nobody's task) inviting an empty household to start from templates. */
export function TemplatesCard() {
  const { colors, radii, shadows, space } = useTheme();
  const router = useRouter();
  return (
    <View
      style={{
        gap: space(4),
        padding: space(5),
        backgroundColor: colors.note,
        borderRadius: radii.note,
        ...shadows.note,
      }}
    >
      <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '600' }}>
        {t('templates.cardTitle')}
      </Text>
      <Button
        testID="today.templates"
        title={t('templates.cardAction')}
        variant="secondary"
        onPress={() => router.push('/templates')}
      />
    </View>
  );
}
