import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { AppState, Linking, Platform, Pressable, Text, View } from 'react-native';
import type { ReminderSettings } from '@/domain/reminders/settings';
import { useSession } from '@/features/auth/SessionProvider';
import { t } from '@/i18n';
import { actionIcons } from '@/ui/actionIcons';
import { Button } from '@/ui/components/Button';
import { Toggle } from '@/ui/components/Toggle';
import { useTheme } from '@/ui/theme';
import { INLINE_PILL_HEIGHT, MIN_TOUCH } from '@/ui/tokens';
import { getPermission, requestPermission } from './notifications';
import type { NotificationPermission } from './plan';
import { useReminderSettings, useSaveReminderSettings } from './useReminders';

const toDate = (time: string): Date => {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return new Date(2000, 0, 1, h, m);
};

const toTime = (date: Date): string =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/** The phone's notification permission, checked again each time the app comes back. */
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

function TimeRow({
  testID,
  label,
  value,
  onChange,
}: {
  testID: string;
  label: string;
  value: string;
  onChange: (time: string) => void;
}) {
  const { colors, radii, space } = useTheme();
  const row = {
    minHeight: MIN_TOUCH,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: space(3),
  };

  if (Platform.OS === 'ios') {
    return (
      <View style={row}>
        <Text style={{ color: colors.ink, fontSize: 16, flexShrink: 1 }}>{label}</Text>
        <DateTimePicker
          testID={testID}
          accessibilityLabel={label}
          value={toDate(value)}
          mode="time"
          display="compact"
          onChange={(_event, date) => {
            if (date) onChange(toTime(date));
          }}
        />
      </View>
    );
  }

  const open = () => {
    // Web has no native picker: the time stays as it is.
    if (Platform.OS !== 'android') return;
    DateTimePickerAndroid.open({
      value: toDate(value),
      mode: 'time',
      is24Hour: true,
      onChange: (event, date) => {
        if (event.type === 'set' && date) onChange(toTime(date));
      },
    });
  };

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
      onPress={open}
      style={row}
    >
      <Text style={{ color: colors.ink, fontSize: 16, flexShrink: 1 }}>{label}</Text>
      {/* The time sits in an outlined pill, so it reads as something to tap and not as plain
          text (in light mode cobalt is the colour of the text). */}
      <View
        style={{
          minHeight: INLINE_PILL_HEIGHT,
          justifyContent: 'center',
          paddingHorizontal: space(4),
          borderRadius: radii.pill,
          borderWidth: 1.5,
          borderColor: colors.cobalt,
        }}
      >
        <Text
          style={{
            color: colors.cobalt,
            fontSize: 17,
            fontWeight: '600',
            fontVariant: ['tabular-nums'],
          }}
        >
          {value}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * "Recordatorios" in Settings. The permission is asked only when the switch is turned on; if
 * the phone says no, the switch stays off and a link to the system settings appears. A
 * permission removed from the system shows the switch off; the app never asks again by itself.
 */
export function ReminderSettingsSection() {
  const { colors, space } = useTheme();
  const { userId } = useSession();
  const settings = useReminderSettings(userId).data;
  const save = useSaveReminderSettings(userId);
  const [permission, setPermission] = usePermission();
  const [asking, setAsking] = useState(false);
  // The phone said no to this user's own request (not shown before they ever try).
  const [refused, setRefused] = useState(false);

  if (!settings || permission === null) return null;

  const on = settings.enabled && permission === 'granted';
  const denied = permission === 'denied' && (settings.enabled || refused);
  const update = (patch: Partial<ReminderSettings>) => save({ ...settings, ...patch });

  const toggle = (value: boolean) => {
    if (!value) {
      update({ enabled: false });
      return;
    }
    if (permission === 'granted') {
      update({ enabled: true });
      return;
    }
    setAsking(true);
    requestPermission()
      .then((granted) => {
        setPermission(granted ? 'granted' : 'denied');
        setRefused(!granted);
        // Denied: the switch goes back to off and nothing is saved.
        if (granted) update({ enabled: true });
      })
      .catch(() => {
        setPermission('denied');
        setRefused(true);
      })
      .finally(() => setAsking(false));
  };

  return (
    <View style={{ gap: space(2) }}>
      <Text
        accessibilityRole="header"
        style={{ color: colors.ink, fontSize: 15, fontWeight: '600' }}
      >
        {t('settings.reminders')}
      </Text>
      <View
        style={{
          minHeight: MIN_TOUCH,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space(3),
        }}
      >
        <Text style={{ color: colors.ink, fontSize: 16, flexShrink: 1 }}>
          {t('settings.remindersToggle')}
        </Text>
        <Toggle
          testID="settings.reminders.toggle"
          accessibilityLabel={t('settings.remindersToggle')}
          value={on || asking}
          disabled={asking}
          onValueChange={toggle}
        />
      </View>
      {denied ? (
        <>
          <Text
            testID="settings.reminders.denied"
            accessibilityLiveRegion="polite"
            style={{ color: colors.ink, fontSize: 14 }}
          >
            {t('settings.remindersDenied')}
          </Text>
          <Button
            title={t('settings.remindersOpenSettings')}
            variant="secondary"
            icon={actionIcons.openPhoneSettings}
            width="hug"
            onPress={() => {
              Linking.openSettings().catch(() => undefined);
            }}
          />
        </>
      ) : null}
      {on ? (
        <>
          <TimeRow
            testID="settings.reminders.morning"
            label={t('settings.remindersMorning')}
            value={settings.morning}
            onChange={(morning) => update({ morning })}
          />
          <TimeRow
            testID="settings.reminders.evening"
            label={t('settings.remindersEvening')}
            value={settings.evening}
            onChange={(evening) => update({ evening })}
          />
        </>
      ) : null}
    </View>
  );
}
