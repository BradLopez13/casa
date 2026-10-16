import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import { actionIcons, type ActionIcon } from '../actionIcons';
import { pressedOpacity } from '../buttonLook';
import { useTheme } from '../theme';

type Props = {
  /** Drawn before the title; decorative, the title is what screen readers hear. */
  icon?: ActionIcon;
  title: string;
  onPress: () => void;
  testID?: string;
};

/** A tappable row that leads to another screen: icon, title and a chevron, with a hairline below. */
export function ListRow({ icon, title, onPress, testID }: Props) {
  const { colors, space } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 56,
        paddingVertical: space(3),
        flexDirection: 'row',
        alignItems: 'center',
        gap: space(3),
        borderBottomWidth: 1,
        borderBottomColor: colors.hairline,
        opacity: pressedOpacity(pressed),
      })}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={22}
          color={colors.ink}
          accessible={false}
          importantForAccessibility="no"
        />
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.ink, fontSize: 17, lineHeight: 24, fontWeight: '400' }}>
          {title}
        </Text>
      </View>
      <Ionicons
        name={actionIcons.chevron}
        size={22}
        color={colors.muted}
        accessible={false}
        importantForAccessibility="no"
      />
    </Pressable>
  );
}
