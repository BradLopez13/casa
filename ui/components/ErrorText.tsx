import { Text } from 'react-native';
import { useTheme } from '../theme';

export function ErrorText({ children, testID }: { children: string; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Text testID={testID} accessibilityRole="alert" style={{ color: colors.danger, fontSize: 14 }}>
      {children}
    </Text>
  );
}
