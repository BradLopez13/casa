import { useEffect } from 'react';
import { AccessibilityInfo, Text } from 'react-native';
import { useTheme } from '../theme';

// Red is kept for overdue tasks only; errors are written plainly in ink and announced.
export function ErrorText({ children, testID }: { children: string; testID?: string }) {
  const { colors } = useTheme();
  // role="alert" is not spoken on iOS, so announce each new message on both platforms.
  useEffect(() => {
    if (children) AccessibilityInfo.announceForAccessibility(children);
  }, [children]);
  return (
    <Text
      testID={testID}
      accessibilityRole="alert"
      style={{ color: colors.ink, fontSize: 15, fontWeight: '600' }}
    >
      {children}
    </Text>
  );
}
