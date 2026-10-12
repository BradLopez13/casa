import { useEffect, useState } from 'react';
import { AppState, Linking, Switch, Text, View } from 'react-native';
import { toAppError } from '@/data/supabase/errors';
import { useSession } from '@/features/auth/SessionProvider';
import { getPermission, requestPermission } from '@/features/reminders/notifications';
import type { NotificationPermission } from '@/features/reminders/plan';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { ErrorText } from '@/ui/components/ErrorText';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';
import { permissionView } from './permissionView';
import { useNotificationPrefs, useSetNotificationPrefs } from './queries';

/** The phone's notification permission, read again each time the app comes back. */
function usePermission(): [NotificationPermission | null, (p: NotificationPermission) => void] {
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  useEffect(() => {
    let alive = true;
    const check = () => {
      getPermission()
        .then((p) => {
          if (alive) setPermission(p);
        })
        .catch(() => undefined);
    };
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);
  return [permission, setPermission];
}

/**
 * "Avisos de la casa" in Settings. The switches are always there, with or without permission.
 * The permission is asked only by the "Activar notificaciones" button.
 */
export function HouseholdNoticesSection() {
  const { colors, space } = useTheme();
  const { userId } = useSession();
  const prefsQuery = useNotificationPrefs(userId);
  const save = useSetNotificationPrefs();
  const [permission, setPermission] = usePermission();
  const [asking, setAsking] = useState(false);

  const prefs = prefsQuery.data;
  const busy = !prefs || save.isPending;
  const view = permissionView(permission);
  const taskAssigned = prefs?.taskAssigned ?? true;
  const memberJoined = prefs?.memberJoined ?? true;
  const error = save.error ?? prefsQuery.error;

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
        style={{ color: colors.ink, fontSize: 15, fontWeight: '600' }}
      >
        {t('settings.push')}
      </Text>
      <View style={row}>
        <Text style={{ color: colors.ink, fontSize: 16, flexShrink: 1 }}>
          {t('settings.pushTaskAssigned')}
        </Text>
        <Switch
          testID="settings.push.task-assigned"
          accessibilityLabel={t('settings.pushTaskAssigned')}
          value={taskAssigned}
          disabled={busy}
          onValueChange={(value) => save.mutate({ taskAssigned: value, memberJoined })}
          trackColor={{ true: colors.cobalt, false: colors.outline }}
          ios_backgroundColor={colors.outline}
        />
      </View>
      <View style={row}>
        <Text style={{ color: colors.ink, fontSize: 16, flexShrink: 1 }}>
          {t('settings.pushMemberJoined')}
        </Text>
        <Switch
          testID="settings.push.member-joined"
          accessibilityLabel={t('settings.pushMemberJoined')}
          value={memberJoined}
          disabled={busy}
          onValueChange={(value) => save.mutate({ taskAssigned, memberJoined: value })}
          trackColor={{ true: colors.cobalt, false: colors.outline }}
          ios_backgroundColor={colors.outline}
        />
      </View>
      {error ? (
        <ErrorText testID="settings.push.error">
          {t(
            toAppError(error).code === 'NETWORK'
              ? 'members.errors.NETWORK'
              : 'members.errors.UNKNOWN',
          )}
        </ErrorText>
      ) : null}
      {view === 'enable' ? (
        <Button
          testID="settings.push.enable"
          title={t('settings.pushEnable')}
          variant="secondary"
          disabled={asking}
          onPress={enable}
        />
      ) : null}
      {view === 'denied' ? (
        <>
          <Text
            testID="settings.push.denied"
            accessibilityLiveRegion="polite"
            style={{ color: colors.ink, fontSize: 14 }}
          >
            {t('settings.remindersDenied')}
          </Text>
          <Button
            title={t('settings.remindersOpenSettings')}
            variant="secondary"
            onPress={() => {
              Linking.openSettings().catch(() => undefined);
            }}
          />
        </>
      ) : null}
    </View>
  );
}
