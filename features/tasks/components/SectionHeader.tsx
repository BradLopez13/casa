import { Text, View } from 'react-native';
import { useTheme } from '@/ui/theme';
import { displayFontBold } from '@/ui/tokens';

/**
 * A task list section heading with its count on the right. `flush` drops its side padding, for a
 * pane whose container already brings the gutter.
 */
export function SectionHeader({
  title,
  count,
  flush = false,
}: {
  title: string;
  count: number;
  flush?: boolean;
}) {
  const { colors, space } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        paddingHorizontal: flush ? 0 : space(5),
        paddingTop: space(6),
        paddingBottom: space(3),
      }}
    >
      <Text
        accessibilityRole="header"
        style={{ flexShrink: 1, color: colors.ink, fontFamily: displayFontBold, fontSize: 15 }}
      >
        {title}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 15, fontVariant: ['tabular-nums'] }}>
        {count}
      </Text>
    </View>
  );
}
