import { Text } from 'react-native';
import { signOut } from '@/features/auth/api';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { Screen } from '@/ui/components/Screen';
import { useTheme } from '@/ui/theme';

// Placeholder: Task 8 replaces this screen.
export default function InviteScreen() {
  const { colors } = useTheme();
  return (
    <Screen>
      <Text style={{ color: colors.text, fontSize: 18 }}>{t('invite.placeholder')}</Text>
      <Button
        testID="invite.sign-out"
        title={t('auth.signOut')}
        variant="secondary"
        onPress={() => void signOut().catch(() => undefined)}
      />
    </Screen>
  );
}
