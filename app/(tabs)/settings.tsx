import { useRouter } from 'expo-router';
import { Fragment, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useIsOnline } from '@/data/query/online';
import { isOwnerAlone } from '@/domain/account/delete';
import { signOut } from '@/features/auth/api';
import { useUnsentCount } from '@/features/offline/unsent';
import { useSession } from '@/features/auth/SessionProvider';
import { DeleteAccountButton } from '@/features/auth/DeleteAccountButton';
import { HouseholdNoticesSection } from '@/features/push/HouseholdNoticesSection';
import { ReminderSettingsSection } from '@/features/reminders/ReminderSettingsSection';
import { HouseholdsSection } from '@/features/households/HouseholdsSection';
import {
  useHouseholds,
  useMembers,
  useMembership,
  useSwitchHousehold,
} from '@/features/households/queries';
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
import { displayFontBold, magnetSizes } from '@/ui/tokens';
import { useLayout } from '@/ui/useLayout';

/**
 * The magnet that holds each note of Ajustes, the glyph of what it holds (fase 10f): no white
 * cards with switches. Your account is held by your own magnet.
 */
/** Where the paper of every note starts: past the half of its magnet that hangs outside it. */
const HANG = magnetSizes.md / 2;

const GLYPHS: Record<Exclude<SettingsGroup, 'account'>, string> = {
  households: 'home-group',
  members: 'account-group-outline',
  reminders: 'alarm',
  notices: 'home-outline',
  help: 'help-circle-outline',
};

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
  // Signing out clears the queue from the phone: with changes still on their way, it says so
  // and offers to wait (bloque 11, T2).
  const unsent = useUnsentCount();
  const { userId } = useSession();
  const membership = useMembership().data;
  const households = useHouseholds().data;
  const switchTo = useSwitchHousehold();
  const members = useMembers(membership?.householdId);
  const list = useMemo(() => members.data ?? [], [members.data]);
  const { marks } = useMemberLabels(list, userId);
  const displayName = list.find((m) => m.userId === userId)?.displayName ?? '';
  const others = list.filter((m) => m.userId !== userId).map((m) => m.displayName);
  const alone = isOwnerAlone(membership?.role, members.data, userId);
  // With several households (bloque 12), the ones where it is only you go with the account.
  const several = (households?.length ?? 0) > 1;
  const aloneIn = several
    ? (households ?? [])
        .filter((h) => h.role === 'owner' && h.memberCount === 1)
        .map((h) => h.householdName)
    : undefined;
  const { left, right } = settingsPanes(paneMode(useLayout()), several);
  // While the name is open, its Guardar is the screen's one pósit; Invitar steps back.
  const [editing, setEditing] = useState(false);
  const notificationsOff = useNotificationPermission() === 'denied';
  const online = useIsOnline();

  const group = (key: SettingsGroup) => {
    switch (key) {
      case 'households':
        return households ? (
          <PinnedNote pin={{ glyph: GLYPHS.households }} side="left">
            <HouseholdsSection
              households={households}
              activeId={membership?.householdId}
              onSwitch={(id) => void switchTo(id)}
            />
          </PinnedNote>
        ) : null;
      case 'members':
        return (
          <PinnedNote pin={{ glyph: GLYPHS.members }} side="left">
            <ListRow
              testID="settings.members"
              title={t('settings.members')}
              onPress={() => router.push('/household/members')}
            />
            <Button
              testID="settings.invite"
              title={t('settings.invite')}
              icon={actionIcons.invite}
              variant={editing ? 'outlined' : 'primary'}
              // Inviting makes a link on the server: offline it says it waits (bloque 13, P3-11).
              disabled={!online}
              waitingFor={t('settings.inviteNeedsNet')}
              onPress={() => router.push('/household/members')}
            />
          </PinnedNote>
        );
      case 'reminders':
        return (
          <PinnedNote pin={{ glyph: GLYPHS.reminders }} side="left">
            <ReminderSettingsSection />
          </PinnedNote>
        );
      case 'notices':
        return (
          <PinnedNote pin={{ glyph: GLYPHS.notices }} side="left">
            <HouseholdNoticesSection />
          </PinnedNote>
        );
      case 'help':
        return (
          <PinnedNote pin={{ glyph: GLYPHS.help }} side="left">
            <ListRow
              testID="settings.help"
              title={t('settings.help')}
              // Alone in its note: no hairline left hanging under it (bloque 13, P3-7).
              divider={false}
              onPress={() => router.push('/help')}
            />
          </PinnedNote>
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
              aloneIn={aloneIn}
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
        // Both keep the paper's left edge where the other notes have it.
        return mark ? (
          <View style={{ paddingLeft: HANG - magnetSizes.sm / 2 }}>
            <PinnedNote testID="settings.account" pin={{ mark }} side="left" size="sm">
              {account}
            </PinnedNote>
          </View>
        ) : (
          <View style={{ paddingLeft: HANG }}>
            <Note>{account}</Note>
          </View>
        );
      }
    }
  };

  const pane = (groups: SettingsGroup[], first: boolean) => (
    <View style={{ gap: space(4), paddingTop: space(5) }}>
      {/* Without the members the door has no name and Borrar waits: say so, and let it retry. A
          failed refetch over members already shown changes nothing. */}
      {first && members.isError && !members.data ? (
        <View style={{ paddingLeft: HANG }}>
          <LoadError
            testID="settings.members-error"
            message={t('members.loadError')}
            retrying={members.isFetching}
            onRetry={() => void members.refetch()}
          />
        </View>
      ) : null}
      {groups.map((key) => (
        <Fragment key={key}>
          {/* One notice for both phone notes: before Recordatorios, which also heads the right
              pane in two columns. */}
          {key === 'reminders' ? (
            <View style={{ paddingLeft: HANG }}>
              <NotificationsOffBand denied={notificationsOff} />
            </View>
          ) : null}
          <View>{group(key)}</View>
        </Fragment>
      ))}
    </View>
  );

  const door = (
    <DoorHeader
      eyebrow={t('settings.title')}
      withHousehold={false}
      heading={
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space(3) }}>
          <View style={{ flex: 1 }}>
            {/* Without the members there is no name to show or edit: no pencil over nothing. */}
            {members.data ? (
              <NameHeading
                name={displayName}
                mark={userId ? marks.get(userId) : undefined}
                editing={editing}
                onEditingChange={setEditing}
              />
            ) : null}
          </View>
          <BrandPlate />
        </View>
      }
      secondary={
        membership
          ? householdLine(membership.householdName, others, (households?.length ?? 1) - 1)
          : undefined
      }
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
        testID="sign-out"
        visible={confirmingSignOut}
        title={t('auth.signOutTitle')}
        message={
          unsent === 0
            ? t('auth.signOutMessage')
            : unsent === 1
              ? t('auth.signOutUnsentOne')
              : t('auth.signOutUnsent', { count: unsent })
        }
        confirmLabel={unsent === 0 ? t('auth.signOutAction') : t('auth.signOutAnyway')}
        cancelLabel={unsent === 0 ? undefined : t('auth.signOutWait')}
        destructive={unsent > 0}
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
