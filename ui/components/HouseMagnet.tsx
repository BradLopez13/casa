import { Platform, Text } from 'react-native';
import { useTheme } from '../theme';
import { displayFont, magnetInitialSizes, type MagnetSize } from '../tokens';
import { Magnet } from './Magnet';

/**
 * A household's magnet (bloque 12): its initial, on `selection` when it is the household shown
 * (the one style of chosen), on the plain ring otherwise. Decorative: the name is read beside it.
 */
export function HouseMagnet({
  initial,
  active,
  size = 'md',
}: {
  initial: string;
  active: boolean;
  size?: MagnetSize;
}) {
  const { colors } = useTheme();
  const letter = (
    <Text
      maxFontSizeMultiplier={1.6}
      style={{
        color: active ? colors.onSelection : colors.ink,
        fontFamily: displayFont,
        fontSize: magnetInitialSizes[size],
        lineHeight: Math.round(magnetInitialSizes[size] * 1.25),
        textAlign: 'center',
        ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
      }}
    >
      {initial}
    </Text>
  );
  return (
    <Magnet
      size={size}
      decorative
      initial=""
      color="teal"
      variant={active ? 'filled' : 'empty'}
      accessibilityLabel=""
      glyph={{ node: letter, fill: active ? colors.selection : 'transparent' }}
    />
  );
}
