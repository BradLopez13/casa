import { Text, View } from 'react-native';
import { t } from '@/i18n';
import { useTheme } from '../theme';
import { NidoSymbol } from './NidoSymbol';

export function BrandHeader() {
  const { colors, space } = useTheme();
  return (
    <View style={{ alignItems: 'flex-start', gap: space(2) }}>
      <NidoSymbol size={48} />
      <Text style={{ color: colors.muted, fontSize: 15 }}>{t('brand.tagline')}</Text>
    </View>
  );
}
