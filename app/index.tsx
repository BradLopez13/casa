import { Text, View } from 'react-native';
import { t } from '@/i18n';
import { useTheme } from '@/ui/theme';

export default function Index() {
  const { colors, space } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: space(4),
        backgroundColor: colors.bg,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 32 }}>{t('app.name')}</Text>
    </View>
  );
}
