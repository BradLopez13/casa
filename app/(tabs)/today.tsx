import { Text } from 'react-native';
import { signOut } from '@/features/auth/api';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { Screen } from '@/ui/components/Screen';
import { useTheme } from '@/ui/theme';

// Placeholder: Task 9 replaces this screen.
export default function TodayScreen() {
  const { colors } = useTheme();
  return (
    <Screen>
      <Text style={{ color: colors.text, fontSize: 18 }}>{t('today.placeholder')}</Text>
      <Button
        testID="today.sign-out"
        title={t('auth.signOut')}
        variant="secondary"
        onPress={() => void signOut().catch(() => undefined)}
      />
    </Screen>
  );
}
