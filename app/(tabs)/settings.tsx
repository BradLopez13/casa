import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import { signOut } from '@/features/auth/api';
import { useSession } from '@/features/auth/SessionProvider';
import { useMembers, useMembership } from '@/features/households/queries';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { Screen } from '@/ui/components/Screen';
import { ScreenTitle } from '@/ui/components/ScreenTitle';
import { useTheme } from '@/ui/theme';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { userId } = useSession();
  const membership = useMembership().data;
  const members = useMembers(membership?.householdId);
  const displayName = members.data?.find((m) => m.userId === userId)?.displayName ?? '';

  return (
    <Screen>
      <ScreenTitle>{t('settings.title')}</ScreenTitle>
      <Text style={{ color: colors.muted, fontSize: 14 }}>{t('settings.displayName')}</Text>
      <Text testID="settings.display-name" style={{ color: colors.ink, fontSize: 18 }}>
        {displayName}
      </Text>
      <Button
        testID="settings.members"
        title={t('settings.members')}
        variant="secondary"
        onPress={() => router.push('/household/members')}
      />
      <Button
        testID="settings.sign-out"
        title={t('auth.signOut')}
        variant="secondary"
        onPress={() => void signOut().catch(() => undefined)}
      />
    </Screen>
  );
}
