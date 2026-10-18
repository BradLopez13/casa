import { Platform, Text, View } from 'react-native';
import { t } from '@/i18n';
import { NidoSymbol } from '@/ui/components/NidoSymbol';
import { useDoorType } from '@/ui/components/DoorHeader';
import { useTheme } from '@/ui/theme';
import { displayFont } from '@/ui/tokens';

const FIGURE_SIZE = 28;

/** The end of the day: the two Nido figures on the brand band and a calm line, set as a door headline. No confetti, points or names. */
export function DayDone() {
  const { colors, radii, space } = useTheme();
  const type = useDoorType();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={{
          backgroundColor: colors.brandBand,
          borderRadius: radii.note,
          padding: space(2),
        }}
      >
        <NidoSymbol size={FIGURE_SIZE} onSlate />
      </View>
      <Text
        style={{
          flexShrink: 1,
          color: colors.ink,
          fontFamily: displayFont,
          fontSize: type.heading,
          lineHeight: type.lineHeight,
          letterSpacing: -type.heading * 0.02,
          ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
        }}
      >
        {t('today.line.allDone')}
      </Text>
    </View>
  );
}
