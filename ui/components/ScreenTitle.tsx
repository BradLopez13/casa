import { Platform, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { displayFont } from '../tokens';

type Props = { children: string; testID?: string; subtitle?: string };

const SIZE = 34;

/**
 * A screen title in the display face. It grows with the phone's text size, capped at 1.3x. With a
 * `subtitle`, a muted sentence sits right under it.
 */
export function ScreenTitle({ children, testID, subtitle }: Props) {
  const { colors, space } = useTheme();
  const title = (
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
  if (!subtitle) return title;
  return (
    <View style={{ gap: space(1) }}>
      {title}
      <Text style={{ color: colors.muted, fontSize: 15 }}>{subtitle}</Text>
    </View>
  );
}
