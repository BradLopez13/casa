import { Text, View } from 'react-native';
import { t } from '@/i18n';
import { NidoSymbol } from '@/ui/components/NidoSymbol';
import { useTheme } from '@/ui/theme';
import { displayFont } from '@/ui/tokens';

const FIGURE_SIZE = 64;

/** The end of the day: the two Nido figures on the brand band and a calm line. No confetti, points or names. */
export function DayDone() {
  const { colors, radii, space } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={{
          backgroundColor: colors.brandBand,
          borderRadius: radii.note,
          padding: space(1),
        }}
      >
        <NidoSymbol size={FIGURE_SIZE} onSlate />
      </View>
      <Text style={{ flexShrink: 1, color: colors.ink, fontFamily: displayFont, fontSize: 20 }}>
        {t('today.line.allDone')}
      </Text>
    </View>
  );
}
