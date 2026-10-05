import { Platform, Text } from 'react-native';
import { useTheme } from '../theme';
import { displayFont } from '../tokens';

type Props = { children: string; testID?: string; size?: number };

/** A screen title in the display face. It grows with the phone's text size, capped at 1.3x. */
export function ScreenTitle({ children, testID, size = 34 }: Props) {
  const { colors } = useTheme();
  return (
    <Text
      testID={testID}
      accessibilityRole="header"
      maxFontSizeMultiplier={1.3}
      style={{
        color: colors.ink,
        fontFamily: displayFont,
        fontSize: size,
        lineHeight: Math.round(size * 1.2),
        letterSpacing: -size * 0.02,
        ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
      }}
    >
      {children}
    </Text>
  );
}
