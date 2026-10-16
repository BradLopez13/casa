import { Text, View } from 'react-native';
import { useTheme } from '../theme';

export function Divider({ label }: { label?: string }) {
  const { colors, space } = useTheme();
  const line = <View style={{ flex: 1, height: 1, backgroundColor: colors.hairline }} />;
  if (!label) return line;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
      {line}
      <Text style={{ color: colors.muted, fontSize: 15 }}>{label}</Text>
      {line}
    </View>
  );
}
