import { useRouter } from 'expo-router';
import { useState } from 'react';
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
import { actionIcons } from '@/ui/actionIcons';
import { AccountZone } from '@/ui/components/AccountZone';
import { Button } from '@/ui/components/Button';
import { useNotice } from '@/ui/components/Notice';
import { ListRow } from '@/ui/components/ListRow';
import { PaneHeader } from '@/ui/components/PaneHeader';
import { ScreenTitle } from '@/ui/components/ScreenTitle';
import { TwoPane } from '@/ui/components/TwoPane';
import { paneMode } from '@/ui/panes';
import { useTheme } from '@/ui/theme';
import { useLayout } from '@/ui/useLayout';

export default function SettingsScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();
  const notify = useNotice();
  const [signingOut, setSigningOut] = useState(false);
  const leave = () => {
    setSigningOut(true);
    signOut()
      .catch(() => notify(t('auth.signOutFailed')))
      .finally(() => setSigningOut(false));
  };
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
            <Text style={{ color: colors.muted, fontSize: 15 }}>{t('settings.displayName')}</Text>
            <Text testID="settings.display-name" style={{ color: colors.ink, fontSize: 17 }}>
              {displayName}
            </Text>
          </View>
        );
      case 'members':
        return (
          <ListRow
            testID="settings.members"
            title={t('settings.members')}
            icon={actionIcons.people}
            onPress={() => router.push('/household/members')}
          />
        );
      case 'reminders':
        return <ReminderSettingsSection />;
      case 'notices':
        return <HouseholdNoticesSection />;
      case 'account':
        return (
          <AccountZone>
            <Button
              testID="settings.sign-out"
              title={t('auth.signOut')}
              variant="tertiary"
              icon={actionIcons.signOut}
              width="hug"
              loading={signingOut}
              onPress={leave}
            />
            <DeleteAccountButton
              testID="settings.delete-account"
              alone={alone}
              disabled={!members.data}
            />
          </AccountZone>
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
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.page }}>
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
