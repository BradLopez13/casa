import { Text, View } from 'react-native';
import { useTheme } from '../theme';

export function Divider({ label }: { label?: string }) {
  const { colors, space } = useTheme();
  // Alone it must not grow in a column parent; inside the labeled row the lines share the width.
  if (!label) {
    return <View style={{ height: 1, alignSelf: 'stretch', backgroundColor: colors.hairline }} />;
  }
  const line = <View style={{ flex: 1, height: 1, backgroundColor: colors.hairline }} />;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
      {line}
      <Text style={{ color: colors.muted, fontSize: 15 }}>{label}</Text>
      {line}
    </View>
  );
}
