import { useRouter } from 'expo-router';
import { Fragment, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useIsOnline } from '@/data/query/online';
import { isOwnerAlone } from '@/domain/account/delete';
import { signOut } from '@/features/auth/api';
import { useSession } from '@/features/auth/SessionProvider';
import { DeleteAccountButton } from '@/features/auth/DeleteAccountButton';
import { HouseholdNoticesSection } from '@/features/push/HouseholdNoticesSection';
import { ReminderSettingsSection } from '@/features/reminders/ReminderSettingsSection';
import { useMembers, useMembership } from '@/features/households/queries';
import { householdLine } from '@/features/settings/householdLine';
import { NotificationsOffBand } from '@/features/settings/NotificationsOffBand';
import { settingsPanes, type SettingsGroup } from '@/features/settings/settingsPanes';
import { useNotificationPermission } from '@/features/settings/useNotificationPermission';
import { useMemberLabels } from '@/features/tasks/useMemberLabels';
import { BrandPlate, NameHeading, Note } from '@/features/settings/SettingsPieces';
import { t } from '@/i18n';
import { actionIcons } from '@/ui/actionIcons';
import { Button } from '@/ui/components/Button';
import { LoadError } from '@/ui/components/LoadError';
import { OfflineBand } from '@/ui/components/OfflineBand';
import { PinnedNote } from '@/ui/components/PinnedNote';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { DoorHeader } from '@/ui/components/DoorHeader';
import { StatusBarVeil } from '@/ui/components/StatusBarVeil';
import { useNotice } from '@/ui/components/Notice';
import { ListRow } from '@/ui/components/ListRow';
import { TwoPane } from '@/ui/components/TwoPane';
import { paneMode } from '@/ui/panes';
import { useTheme } from '@/ui/theme';
import { displayFontBold } from '@/ui/tokens';
import { useLayout } from '@/ui/useLayout';

export default function SettingsScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();
  const notify = useNotice();
  const [signingOut, setSigningOut] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const leave = () => {
    setSigningOut(true);
    signOut()
      .catch(() => notify(t('auth.signOutFailed')))
      .finally(() => {
        setSigningOut(false);
        setConfirmingSignOut(false);
      });
  };
  const { userId } = useSession();
  const membership = useMembership().data;
  const members = useMembers(membership?.householdId);
  const list = useMemo(() => members.data ?? [], [members.data]);
  const { marks } = useMemberLabels(list, userId);
  const displayName = list.find((m) => m.userId === userId)?.displayName ?? '';
  const others = list.filter((m) => m.userId !== userId).map((m) => m.displayName);
  const alone = isOwnerAlone(membership?.role, members.data, userId);
  const { left, right } = settingsPanes(paneMode(useLayout()));
  // While the name is open, its Guardar is the screen's one pósit; Invitar steps back.
  const [editing, setEditing] = useState(false);
  const notificationsOff = useNotificationPermission() === 'denied';
  const online = useIsOnline();

  const group = (key: SettingsGroup) => {
    switch (key) {
      case 'members':
        return (
          <Note>
            <ListRow
              testID="settings.members"
              title={t('settings.members')}
              icon={actionIcons.people}
              onPress={() => router.push('/household/members')}
            />
            <Button
              testID="settings.invite"
              title={t('settings.invite')}
              icon={actionIcons.invite}
              variant={editing ? 'secondary' : 'primary'}
              onPress={() => router.push('/household/members')}
            />
          </Note>
        );
      case 'reminders':
        return (
          <Note>
            <ReminderSettingsSection />
          </Note>
        );
      case 'notices':
        return (
          <Note>
            <HouseholdNoticesSection />
          </Note>
        );
      case 'help':
        return (
          <Note>
            <ListRow
              testID="settings.help"
              title={t('settings.help')}
              icon={actionIcons.help}
              onPress={() => router.push('/help')}
            />
          </Note>
        );
      case 'account': {
        const mark = userId ? marks.get(userId) : undefined;
        const account = (
          <>
            <Text
              accessibilityRole="header"
              style={{ color: colors.ink, fontFamily: displayFontBold, fontSize: 15 }}
            >
              {t('settings.account')}
            </Text>
            <Button
              testID="settings.sign-out"
              title={t('auth.signOut')}
              variant="tertiary"
              icon={actionIcons.signOut}
              width="hug"
              flush
              onPress={() => setConfirmingSignOut(true)}
            />
            <DeleteAccountButton
              testID="settings.delete-account"
              alone={alone}
              disabled={!members.data}
              quiet
            />
            {/* Deleting needs to know who else is in the household; until then, say why it waits. */}
            {members.data || members.isError ? null : (
              <Text
                testID="settings.delete-account.waiting"
                style={{ marginTop: -space(2), color: colors.muted, fontSize: 14 }}
              >
                {t('settings.deleteAccountWaiting')}
              </Text>
            )}
          </>
        );
        // Your account is a small note held by your own magnet; until the members load, a plain one.
        return mark ? (
          <PinnedNote testID="settings.account" pin={{ mark }} side="left" size="sm">
            {account}
          </PinnedNote>
        ) : (
          <Note>{account}</Note>
        );
      }
    }
  };

  const pane = (groups: SettingsGroup[], first: boolean) => (
    <View style={{ gap: space(4), paddingTop: space(5) }}>
      {/* Without the members the door has no name and Borrar waits: say so, and let it retry. A
          failed refetch over members already shown changes nothing. */}
      {first && members.isError && !members.data ? (
        <LoadError
          testID="settings.members-error"
          message={t('members.loadError')}
          retrying={members.isFetching}
          onRetry={() => void members.refetch()}
        />
      ) : null}
      {groups.map((key) => (
        <Fragment key={key}>
          {/* One notice for both phone notes: before Recordatorios, which also heads the right
              pane in two columns. */}
          {key === 'reminders' ? <NotificationsOffBand denied={notificationsOff} /> : null}
          <View>{group(key)}</View>
        </Fragment>
      ))}
    </View>
  );

  const door = (
    <DoorHeader
      eyebrow={t('settings.title')}
      heading={
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space(3) }}>
          <View style={{ flex: 1 }}>
            <NameHeading
              name={displayName}
              mark={userId ? marks.get(userId) : undefined}
              editing={editing}
              onEditingChange={setEditing}
            />
          </View>
          <BrandPlate />
        </View>
      }
      secondary={membership ? householdLine(membership.householdName, others) : undefined}
      secondaryTestID="settings.household-name"
    />
  );
  const doorAndBand = (
    <View>
      {door}
      {online ? null : <OfflineBand label={t('settings.offline')} testID="settings.offline" />}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ConfirmDialog
        visible={confirmingSignOut}
        title={t('auth.signOutTitle')}
        message={t('auth.signOutMessage')}
        confirmLabel={t('auth.signOutAction')}
        loading={signingOut}
        onCancel={() => setConfirmingSignOut(false)}
        onConfirm={leave}
      />
      {/* Scrolled, the door would pass under the clock: the veil keeps the status bar door-coloured. */}
      <StatusBarVeil>
        <TwoPane
          header={doorAndBand}
          left={pane(left, true)}
          right={right.length > 0 ? pane(right, false) : null}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: space(8) }}
        />
      </StatusBarVeil>
    </View>
  );
}
