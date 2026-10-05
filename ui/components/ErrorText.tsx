import { Text } from 'react-native';
import { useTheme } from '../theme';

// Red is kept for overdue tasks only; errors are written plainly in ink and announced.
export function ErrorText({ children, testID }: { children: string; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Text
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ color: colors.ink, fontSize: 15, fontWeight: '600' }}
    >
      {children}
    </Text>
  );
}
