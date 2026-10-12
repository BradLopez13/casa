import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isOwnerAlone } from '@/domain/account/delete';
import { signOut } from '@/features/auth/api';
import { useSession } from '@/features/auth/SessionProvider';
import { DeleteAccountButton } from '@/features/auth/DeleteAccountButton';
import { HouseholdNoticesSection } from '@/features/push/HouseholdNoticesSection';
import { ReminderSettingsSection } from '@/features/reminders/ReminderSettingsSection';
import { useMembers, useMembership } from '@/features/households/queries';
import { settingsPanes, startsBlock, type SettingsGroup } from '@/features/settings/settingsPanes';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { PaneHeader } from '@/ui/components/PaneHeader';
import { ScreenTitle } from '@/ui/components/ScreenTitle';
import { TwoPane } from '@/ui/components/TwoPane';
import { paneMode } from '@/ui/panes';
import { useTheme } from '@/ui/theme';
import { useLayout } from '@/ui/useLayout';

export default function SettingsScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();
  const { userId } = useSession();
  const membership = useMembership().data;
  const members = useMembers(membership?.householdId);
  const displayName = members.data?.find((m) => m.userId === userId)?.displayName ?? '';
  const alone = isOwnerAlone(membership?.role, members.data, userId);
  const { left, right } = settingsPanes(paneMode(useLayout()));

  const group = (key: SettingsGroup) => {
    switch (key) {
      case 'profile':
        return (
          <View style={{ gap: space(1) }}>
            <Text style={{ color: colors.muted, fontSize: 14 }}>{t('settings.displayName')}</Text>
            <Text
              testID="settings.display-name"
              style={{ color: colors.ink, fontSize: 18, fontWeight: '600' }}
            >
              {displayName}
            </Text>
          </View>
        );
      case 'members':
        return (
          <Button
            testID="settings.members"
            title={t('settings.members')}
            variant="secondary"
            onPress={() => router.push('/household/members')}
          />
        );
      case 'reminders':
        return <ReminderSettingsSection />;
      case 'notices':
        return <HouseholdNoticesSection />;
      case 'account':
        return (
          <View style={{ gap: space(3) }}>
            <Button
              testID="settings.sign-out"
              title={t('auth.signOut')}
              variant="secondary"
              onPress={() => void signOut().catch(() => undefined)}
            />
            <DeleteAccountButton
              testID="settings.delete-account"
              alone={alone}
              disabled={!members.data}
            />
          </View>
        );
    }
  };

  // Each group sits apart from the next: more space above a section than inside it.
  const pane = (groups: SettingsGroup[]) => (
    <View style={{ gap: space(4) }}>
      {groups.map((key, index) => (
        <View key={key} style={startsBlock(groups, index) ? { marginTop: space(4) } : null}>
          {group(key)}
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.page }}>
      <TwoPane
        header={
          <PaneHeader>
            <ScreenTitle>{t('settings.title')}</ScreenTitle>
          </PaneHeader>
        }
        left={pane(left)}
        right={right.length > 0 ? pane(right) : null}
        contentContainerStyle={{ paddingBottom: space(8) }}
      />
    </SafeAreaView>
  );
}
