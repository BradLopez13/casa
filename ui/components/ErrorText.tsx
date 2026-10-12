import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';
import { useTheme } from '../theme';

// Red is kept for overdue tasks only; errors are written plainly in ink, marked with an icon (so
// they never depend on colour) and announced.
export function ErrorText({ children, testID }: { children: string; testID?: string }) {
  const { colors, space } = useTheme();
  // role="alert" is not spoken on iOS, so announce each new message on both platforms.
  useEffect(() => {
    if (children) AccessibilityInfo.announceForAccessibility(children);
  }, [children]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space(2) }}>
      <Ionicons
        name="alert-circle"
        size={18}
        color={colors.ink}
        accessible={false}
        importantForAccessibility="no"
        // Centred on the first line of 15pt text.
        style={{ marginTop: 1 }}
      />
      <Text
        testID={testID}
        accessibilityRole="alert"
        style={{ flex: 1, color: colors.ink, fontSize: 15, fontWeight: '600' }}
      >
        {children}
      </Text>
    </View>
  );
}
