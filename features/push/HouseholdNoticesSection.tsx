import { useState } from 'react';
import { Text, View } from 'react-native';
import { useSession } from '@/features/auth/SessionProvider';
import { requestPermission } from '@/features/reminders/notifications';
import { settingsErrorMessage } from '@/features/settings/errors';
import { usePhonePermission } from '@/features/settings/useNotificationPermission';
import { t } from '@/i18n';
import { actionIcons } from '@/ui/actionIcons';
import { Button } from '@/ui/components/Button';
import { ErrorText } from '@/ui/components/ErrorText';
import { MagnetSwitch } from '@/ui/components/MagnetSwitch';
import { useTheme } from '@/ui/theme';
import { displayFontBold, MIN_TOUCH } from '@/ui/tokens';
import { permissionView } from './permissionView';
import { switchState } from './permissionState';
import { useNotificationPrefs, useSetNotificationPrefs } from './queries';

/**
 * "Avisos del hogar" in Settings. The switches are always there, with or without permission.
 * The permission is asked only by the "Activar notificaciones" button.
 */
export function HouseholdNoticesSection() {
  const { colors, space } = useTheme();
  const { userId } = useSession();
  const prefsQuery = useNotificationPrefs(userId);
  const save = useSetNotificationPrefs();
  const [permission, setPermission] = usePhonePermission();
  const [asking, setAsking] = useState(false);

  const prefs = prefsQuery.data;
  // Saving keeps each switch's look; until the prefs load there is no state to show at all (an
  // «on» or a dashed ring would both say something the app does not know).
  const busy = save.isPending;
  const view = permissionView(permission);
  const taskAssigned = prefs?.taskAssigned ?? true;
  const memberJoined = prefs?.memberJoined ?? true;
  const error = save.error ?? prefsQuery.error;
  const known = permission ?? 'granted';
  const taskState = switchState(taskAssigned, known);
  const joinedState = switchState(memberJoined, known);

  const enable = () => {
    setAsking(true);
    requestPermission()
      .then((granted) => setPermission(granted ? 'granted' : 'denied'))
      .catch(() => setPermission('denied'))
      .finally(() => setAsking(false));
  };

  const row = {
    minHeight: MIN_TOUCH,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: space(3),
  };

  return (
    <View style={{ gap: space(2) }}>
      <Text
        accessibilityRole="header"
        style={{ color: colors.ink, fontFamily: displayFontBold, fontSize: 15 }}
      >
        {t('settings.push')}
      </Text>
      {prefs ? (
        <>
          <View style={row}>
            <Text style={{ color: colors.ink, fontSize: 16, flexShrink: 1 }}>
              {t('settings.pushTaskAssigned')}
            </Text>
            <MagnetSwitch
              testID="settings.push.task-assigned"
              accessibilityLabel={t('settings.pushTaskAssigned')}
              value={taskState.value}
              disabled={taskState.disabled}
              busy={busy}
              onValueChange={(value) => save.mutate({ taskAssigned: value, memberJoined })}
            />
          </View>
          {taskState.caption ? (
            <Text style={{ color: colors.muted, fontSize: 13 }}>{taskState.caption}</Text>
          ) : null}
          <View style={row}>
            <Text style={{ color: colors.ink, fontSize: 16, flexShrink: 1 }}>
              {t('settings.pushMemberJoined')}
            </Text>
            <MagnetSwitch
              testID="settings.push.member-joined"
              accessibilityLabel={t('settings.pushMemberJoined')}
              value={joinedState.value}
              disabled={joinedState.disabled}
              busy={busy}
              onValueChange={(value) => save.mutate({ taskAssigned, memberJoined: value })}
            />
          </View>
          {joinedState.caption ? (
            <Text style={{ color: colors.muted, fontSize: 13 }}>{joinedState.caption}</Text>
          ) : null}
        </>
      ) : null}
      {error ? (
        <ErrorText testID="settings.push.error">{settingsErrorMessage(error)}</ErrorText>
      ) : null}
      {view === 'enable' ? (
        <Button
          testID="settings.push.enable"
          title={t('settings.pushEnable')}
          variant="outlined"
          icon={actionIcons.openPhoneSettings}
          width="hug"
          disabled={asking}
          onPress={enable}
        />
      ) : null}
    </View>
  );
}
