import { Platform, Text, View } from 'react-native';
import { t } from '@/i18n';
import { useDoorType } from '@/ui/components/DoorHeader';
import { SymbolPlate } from '@/ui/components/SymbolPlate';
import { DOOR_MAX_SCALE } from '@/ui/door';
import { useTheme } from '@/ui/theme';
import { displayFont } from '@/ui/tokens';

/** The end of the day: the two Nido figures on their slate plate and a calm line, set as a door headline. No confetti, points or names. */
export function DayDone() {
  const { colors, space } = useTheme();
  const type = useDoorType();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
      <SymbolPlate />
      <Text
        maxFontSizeMultiplier={DOOR_MAX_SCALE}
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
