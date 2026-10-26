import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, Text, View } from 'react-native';
import { addDays, localDateIso, toLocalDate } from '@/domain/tasks/dates';
import { isQuickDay, quickDays } from '@/domain/tasks/day-cells';
import { dayCellLabel, weekdayDay } from '@/domain/tasks/labels';
import { locale, t } from '@/i18n';
import { buttonLook, pressedOpacity } from '@/ui/buttonLook';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH, displayFont } from '@/ui/tokens';

type Props = {
  value: string | null;
  today: string;
  onChange: (value: string | null) => void;
  /** Phase 4 hides "Sin fecha" for tasks that must have a date. */
  noneDisabled?: boolean;
  /**
   * The past date the task was due on when the form opened, if any. It goes first, as «dom 11
   * (pasada)», and stays selectable after another day is chosen.
   */
  past?: string | null;
};

type CellProps = {
  testID: string;
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  /** The day number, drawn large over the label. */
  top?: string;
  /** Drawn in `muted` while not chosen (the past date). */
  quiet?: boolean;
  /** What a screen reader says, when the drawn label is too short to say it («20 mar»). */
  spoken?: string;
};

function Cell({
  testID,
  label,
  selected,
  disabled = false,
  onPress,
  top,
  quiet,
  spoken,
}: CellProps) {
  const { colors, radii, space } = useTheme();
  // A cell that cannot be chosen keeps its solid outline and fades its label: dashed is paused.
  const off = buttonLook('outlined', 'default', 'disabled', colors);
  const labelColor = disabled
    ? off.foreground
    : selected
      ? colors.onSelection
      : top || quiet
        ? colors.muted
        : colors.ink;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      accessibilityLabel={spoken ?? (top ? `${top} ${label}` : label)}
      style={({ pressed }) => ({
        minWidth: MIN_TOUCH + space(3),
        minHeight: top ? MIN_TOUCH + space(3) : MIN_TOUCH,
        paddingHorizontal: space(4),
        paddingVertical: top ? space(1) : 0,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.pill,
        // One selected style (§14.1): chosen is filled with `selection`, the rest outlined on
        // the note, so it reads by shape and not by the label's colour alone.
        borderWidth: 1.5,
        borderColor: disabled ? off.border : selected ? colors.selection : colors.outline,
        backgroundColor: disabled ? off.fill : selected ? colors.selection : colors.note,
        opacity: pressedOpacity(pressed),
      })}
    >
      {top ? (
        <Text
          style={{
            fontFamily: displayFont,
            fontSize: 20,
            color: selected ? colors.onSelection : colors.ink,
            fontVariant: ['tabular-nums'],
          }}
        >
          {top}
        </Text>
      ) : null}
      <Text
        style={{
          fontSize: top ? 13 : 15,
          fontWeight: top ? undefined : '600',
          color: labelColor,
          fontVariant: ['tabular-nums'],
          opacity: disabled ? off.labelOpacity : 1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function shortDate(iso: string): string {
  return weekdayDay(iso, 'short');
}

/**
 * The due-date field: a past date first when the task had one, four quick days as two-line pills,
 * then "Otro día" (native picker) and "Sin fecha" on a row of their own.
 */
export function DayCells({ value, today, onChange, noneDisabled, past = null }: Props) {
  const { space } = useTheme();
  const pastDay = past !== null && past < today ? past : null;
  const otherValue =
    value !== null && !isQuickDay(value, today) && value !== pastDay ? value : null;
  const other = otherValue !== null;
  const showIosPicker = Platform.OS === 'ios' && otherValue !== null;

  const otherLabel = otherValue !== null ? shortDate(otherValue) : t('taskForm.dueOther');

  const openOther = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: toLocalDate(value ?? today),
        mode: 'date',
        minimumDate: undefined,
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(localDateIso(date));
        },
      });
    } else if (Platform.OS === 'ios' && !other) {
      // iOS shows the inline picker below once "Otro día" is active.
      onChange(addDays(today, 4));
    }
    // Web has no native picker: leave the value unchanged.
  };

  const row = { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) } as const;

  return (
    <View style={{ gap: space(2) }}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('taskForm.dueLabel')}
        style={{ gap: space(2) }}
      >
        {pastDay !== null ? (
          <View style={row}>
            <Cell
              testID={`task-form.due.${pastDay}`}
              label={t('taskForm.pastDate', { date: shortDate(pastDay) })}
              selected={value === pastDay}
              quiet
              onPress={() => onChange(pastDay)}
            />
          </View>
        ) : null}
        <View style={row}>
          {quickDays(today).map((day, i) => (
            <Cell
              key={day}
              testID={`task-form.due.${day}`}
              top={String(toLocalDate(day).getDate())}
              label={
                i === 0
                  ? t('tasks.due.today')
                  : toLocalDate(day).toLocaleDateString(locale, { weekday: 'short' })
              }
              spoken={dayCellLabel(day, today)}
              selected={value === day}
              onPress={() => onChange(day)}
            />
          ))}
        </View>
        <View style={row}>
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
      </View>
      {showIosPicker ? (
        <DateTimePicker
          value={toLocalDate(otherValue)}
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
