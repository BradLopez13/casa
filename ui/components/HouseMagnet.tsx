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
  // Two letters (two households with the same initial) go smaller and never wrap (bloque 14.5).
  const two = Array.from(initial).length > 1;
  const letter = (
    <Text
      maxFontSizeMultiplier={1.6}
      numberOfLines={1}
      adjustsFontSizeToFit={two}
      style={{
        color: active ? colors.onSelection : colors.ink,
        fontFamily: displayFont,
        fontSize: Math.round(magnetInitialSizes[size] * (two ? 0.75 : 1)),
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
