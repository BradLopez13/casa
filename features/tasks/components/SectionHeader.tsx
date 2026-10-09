import { Text, View } from 'react-native';
import { useTheme } from '@/ui/theme';

/** A task list section heading with its count on the right. */
export function SectionHeader({ title, count }: { title: string; count: number }) {
  const { colors, space } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        paddingHorizontal: space(5),
        paddingTop: space(6),
        paddingBottom: space(3),
      }}
    >
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={1.3}
        style={{ color: colors.ink, fontSize: 15, fontWeight: '600' }}
      >
        {title}
      </Text>
      <Text
        maxFontSizeMultiplier={1.3}
        style={{ color: colors.muted, fontSize: 15, fontVariant: ['tabular-nums'] }}
      >
        {count}
      </Text>
    </View>
  );
}
