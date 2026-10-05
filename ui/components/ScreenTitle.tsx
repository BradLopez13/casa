import { Platform, Text } from 'react-native';
import { useTheme } from '../theme';
import { displayFont } from '../tokens';

type Props = { children: string; testID?: string };

const SIZE = 34;

/** A screen title in the display face. It grows with the phone's text size, capped at 1.3x. */
export function ScreenTitle({ children, testID }: Props) {
  const { colors } = useTheme();
  return (
    <Text
      testID={testID}
      accessibilityRole="header"
      maxFontSizeMultiplier={1.3}
      style={{
        color: colors.ink,
        fontFamily: displayFont,
        fontSize: SIZE,
        lineHeight: Math.round(SIZE * 1.2),
        letterSpacing: -SIZE * 0.02,
        ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
      }}
    >
      {children}
    </Text>
  );
}
