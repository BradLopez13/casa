import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, Text, View } from 'react-native';
import { addDays, localDateIso } from '@/domain/tasks/dates';
import { isQuickDay, quickDays } from '@/domain/tasks/day-cells';
import { locale, t } from '@/i18n';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH, displayFont } from '@/ui/tokens';

type Props = {
  value: string | null;
  today: string;
  onChange: (value: string | null) => void;
  /** Phase 4 hides "Sin fecha" for tasks that must have a date. */
  noneDisabled?: boolean;
};

/** A local Date from YYYY-MM-DD (local fields, never UTC). */
function toDate(iso: string): Date {
  const [y = 1970, m = 1, d = 1] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

type CellProps = {
  testID: string;
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  top?: string;
  topIsDisplay?: boolean;
};

function Cell({ testID, label, selected, disabled, onPress, top, topIsDisplay }: CellProps) {
  const { colors, radii, space } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      accessibilityLabel={top ? `${top} ${label}` : label}
      style={{
        minWidth: MIN_TOUCH + space(3),
        minHeight: MIN_TOUCH + space(2),
        paddingHorizontal: space(2),
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.day,
        backgroundColor: colors.door,
        borderWidth: 2,
        borderColor: selected ? colors.cobalt : 'transparent',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {top ? (
        <Text
          style={{
            fontFamily: topIsDisplay ? displayFont : undefined,
            fontSize: 20,
            color: colors.ink,
            fontVariant: ['tabular-nums'],
          }}
        >
          {top}
        </Text>
      ) : null}
      <Text
        style={{
          fontSize: 13,
          color: selected ? colors.cobalt : colors.muted,
          fontVariant: ['tabular-nums'],
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** The due-date field: four quick days, "Otro…" (native picker) and "Sin fecha". */
export function DayCells({ value, today, onChange, noneDisabled }: Props) {
  const { space } = useTheme();
  const otherValue = value !== null && !isQuickDay(value, today) ? value : null;
  const other = otherValue !== null;
  const showIosPicker = Platform.OS === 'ios' && otherValue !== null;

  const otherLabel =
    otherValue !== null
      ? toDate(otherValue).toLocaleDateString(locale, { weekday: 'short', day: 'numeric' })
      : t('taskForm.dueOther');

  const openOther = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: toDate(value ?? today),
        mode: 'date',
        minimumDate: undefined,
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(localDateIso(date));
        },
      });
    } else if (Platform.OS === 'ios' && !other) {
      // iOS shows the inline picker below once "Otro…" is active.
      onChange(addDays(today, 4));
    }
    // Web has no native picker: leave the value unchanged.
  };

  return (
    <View>
      <View
        accessibilityRole="radiogroup"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}
      >
        {quickDays(today).map((day, i) => (
          <Cell
            key={day}
            testID={`task-form.due.${day}`}
            top={String(toDate(day).getDate())}
            topIsDisplay
            label={
              i === 0
                ? t('tasks.due.today')
                : toDate(day).toLocaleDateString(locale, { weekday: 'short' })
            }
            selected={value === day}
            onPress={() => onChange(day)}
          />
        ))}
        <Cell
          testID="task-form.due.other"
          label={otherLabel}
          selected={other}
          onPress={openOther}
        />
        <Cell
          testID="task-form.due.none"
          label={t('tasks.due.none')}
          selected={value === null}
          disabled={noneDisabled}
          onPress={() => onChange(null)}
        />
      </View>
      {showIosPicker ? (
        <DateTimePicker
          value={toDate(otherValue)}
          mode="date"
          display="inline"
          onChange={(_event, date) => {
            if (date) onChange(localDateIso(date));
          }}
        />
      ) : null}
    </View>
  );
}
