import { Pressable, Text, View } from 'react-native';
import { choiceOf, ruleForChoice, type RepeatChoice } from '@/domain/recurrence/form';
import { recurrenceLabel } from '@/domain/recurrence/label';
import type { IsoWeekday, RecurrenceRule } from '@/domain/recurrence/rule';
import { t } from '@/i18n';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';

type Props = {
  value: RecurrenceRule | null;
  dueOn: string;
  onChange: (rule: RecurrenceRule | null) => void;
};

const CHOICES: RepeatChoice[] = ['none', 'daily', 'weekly', 'interval', 'monthly'];
const WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];
const EVERY_MIN = 2;
const EVERY_MAX = 365;

function Pill({
  testID,
  label,
  selected,
  onPress,
}: {
  testID: string;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, radii, space } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: MIN_TOUCH,
        paddingHorizontal: space(4),
        justifyContent: 'center',
        borderRadius: radii.pill,
        borderWidth: 2,
        borderColor: selected ? colors.cobalt : colors.outline,
        backgroundColor: selected ? colors.door : colors.note,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text
        maxFontSizeMultiplier={1.3}
        style={{
          color: selected ? colors.cobalt : colors.ink,
          fontSize: 15,
          fontWeight: selected ? '700' : '500',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function WeekdayToggles({
  days,
  onChange,
}: {
  days: IsoWeekday[];
  onChange: (days: IsoWeekday[]) => void;
}) {
  const { colors, radii, space } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
      {WEEKDAYS.map((day) => {
        const checked = days.includes(day);
        // The last day left cannot be unchecked: a weekly rule needs at least one.
        const locked = checked && days.length === 1;
        return (
          <Pressable
            key={day}
            testID={`task-form.repeat.day.${day}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked, disabled: locked }}
            accessibilityLabel={t(`weekdays.${day}`)}
            disabled={locked}
            onPress={() =>
              onChange(
                checked ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b),
              )
            }
            style={({ pressed }) => ({
              width: MIN_TOUCH,
              height: MIN_TOUCH,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radii.pill,
              borderWidth: 2,
              borderColor: checked ? colors.cobalt : colors.outline,
              backgroundColor: checked ? colors.door : colors.note,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text
              maxFontSizeMultiplier={1.3}
              style={{
                color: checked ? colors.cobalt : colors.ink,
                fontSize: 15,
                fontWeight: checked ? '700' : '500',
              }}
            >
              {t(`weekdays.short.${day}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StepButton({
  testID,
  label,
  symbol,
  disabled,
  onPress,
}: {
  testID: string;
  label: string;
  symbol: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors, radii } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: MIN_TOUCH,
        height: MIN_TOUCH,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.pill,
        borderWidth: 2,
        borderColor: colors.outline,
        backgroundColor: colors.note,
        opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
      })}
    >
      <Text maxFontSizeMultiplier={1.3} style={{ color: colors.cobalt, fontSize: 20 }}>
        {symbol}
      </Text>
    </Pressable>
  );
}

function EveryStepper({ every, onChange }: { every: number; onChange: (every: number) => void }) {
  const { colors, space } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
      <StepButton
        testID="task-form.repeat.every.minus"
        label={t('taskForm.everyMinus')}
        symbol="−"
        disabled={every <= EVERY_MIN}
        onPress={() => onChange(Math.max(EVERY_MIN, every - 1))}
      />
      <Text
        accessibilityLiveRegion="polite"
        maxFontSizeMultiplier={1.3}
        style={{ color: colors.ink, fontSize: 15, fontVariant: ['tabular-nums'] }}
      >
        {t('recurrence.everyN', { n: every })}
      </Text>
      <StepButton
        testID="task-form.repeat.every.plus"
        label={t('taskForm.everyPlus')}
        symbol="+"
        disabled={every >= EVERY_MAX}
        onPress={() => onChange(Math.min(EVERY_MAX, every + 1))}
      />
    </View>
  );
}

/** "Se repite": no, daily, weekly on some days, every N days or monthly on the date's day. */
export function RecurrencePicker({ value, dueOn, onChange }: Props) {
  const { colors, space } = useTheme();
  const choice = choiceOf(value);

  return (
    <View style={{ gap: space(3) }}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('taskForm.repeatLabel')}
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}
      >
        {CHOICES.map((option) => (
          <Pill
            key={option}
            testID={`task-form.repeat.${option}`}
            label={t(`taskForm.repeat.${option}`)}
            selected={option === choice}
            onPress={() => {
              if (option !== choice) onChange(ruleForChoice(option, dueOn));
            }}
          />
        ))}
      </View>
      {value?.kind === 'weekly' ? (
        <WeekdayToggles days={value.days} onChange={(days) => onChange({ kind: 'weekly', days })} />
      ) : null}
      {value?.kind === 'interval' && choice === 'interval' ? (
        <EveryStepper
          every={value.every}
          onChange={(every) => onChange({ kind: 'interval', every })}
        />
      ) : null}
      {value?.kind === 'monthly' ? (
        <Text maxFontSizeMultiplier={1.3} style={{ color: colors.ink, fontSize: 15 }}>
          {recurrenceLabel(value)}
        </Text>
      ) : null}
    </View>
  );
}
