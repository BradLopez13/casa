import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { toAppError } from '@/data/supabase/errors';
import { deleteFailureKind, isOwnerAlone, type DeleteFailure } from '@/domain/account/delete';
import { signOut } from '@/features/auth/api';
import { useSession } from '@/features/auth/SessionProvider';
import { useDeleteAccount } from '@/features/auth/useDeleteAccount';
import { ReminderSettingsSection } from '@/features/reminders/ReminderSettingsSection';
import { useMembers, useMembership } from '@/features/households/queries';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { ErrorText } from '@/ui/components/ErrorText';
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
  const alone = isOwnerAlone(membership?.role, members.data, userId);
  const deletion = useDeleteAccount();
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<DeleteFailure | null>(null);

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
      <ReminderSettingsSection />
      <Button
        testID="settings.sign-out"
        title={t('auth.signOut')}
        variant="secondary"
        onPress={() => void signOut().catch(() => undefined)}
      />
      <Button
        testID="settings.delete-account"
        title={t('settings.deleteAccount')}
        variant="danger"
        onPress={() => {
          setFailure(null);
          setConfirming(true);
        }}
      />
      {failure === 'transfer' ? (
        <>
          <ErrorText testID="settings.delete-account.error">
            {t('settings.deleteAccountTransfer')}
          </ErrorText>
          <Button
            testID="settings.delete-account.go-members"
            title={t('settings.goToMembers')}
            variant="secondary"
            onPress={() => router.push('/household/members')}
          />
        </>
      ) : failure === 'unknown' ? (
        <ErrorText testID="settings.delete-account.error">{t('members.errors.UNKNOWN')}</ErrorText>
      ) : null}
      <ConfirmDialog
        visible={confirming}
        title={t('settings.deleteAccountTitle')}
        message={t(alone ? 'settings.deleteAccountMessageAlone' : 'settings.deleteAccountMessage')}
        confirmLabel={t('settings.deleteAccountAction')}
        destructive
        loading={deletion.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          deletion.run({
            onError: (e) => {
              setConfirming(false);
              setFailure(deleteFailureKind(toAppError(e).code));
            },
          })
        }
      />
    </Screen>
  );
}
