import { Pressable, ScrollView, Text } from 'react-native';
import { dayCountLabel, type StripDay } from '@/domain/tasks/strip';
import { dayPills } from '@/features/tasks/dayFilter';
import { t } from '@/i18n';
import { pressedOpacity } from '@/ui/buttonLook';
import { DOOR_MAX_SCALE } from '@/ui/door';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';

type Props = {
  /** The seven days from today (`weekStrip`). */
  days: StripDay[];
  today: string;
  /** The day the list is filtered by, or null for «Todas». */
  chosen: string | null;
  names: Map<string, string>;
  onSelect: (date: string | null) => void;
};

/**
 * The row under the quick add of Tareas: «Todas · Hoy · Mañana · mié 22 ›», one line of pills
 * that scrolls sideways. It only filters the list; the chosen pill is filled with `selection`,
 * the rest outlined (§14.1, one selected style).
 */
export function DayPills({ days, today, chosen, names, onSelect }: Props) {
  const { colors, radii, space } = useTheme();
  const pills = dayPills(days, today);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      accessibilityRole="radiogroup"
      accessibilityLabel={t('tasks.pill.label')}
      // The row bleeds past the column so a half pill at the edge says there is more.
      style={{ marginHorizontal: -space(5) }}
      contentContainerStyle={{ paddingHorizontal: space(5), gap: space(2) }}
    >
      {pills.map((pill) => {
        const selected = pill.date === chosen;
        const day = pill.date === null ? null : days.find((d) => d.date === pill.date);
        return (
          <Pressable
            key={pill.date ?? 'all'}
            testID={`tasks.pill.${pill.date ?? 'all'}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={day ? dayCountLabel(day, today, names) : t('tasks.pill.allLabel')}
            onPress={() => onSelect(pill.date)}
            style={({ pressed }) => ({
              minHeight: MIN_TOUCH,
              paddingHorizontal: space(4),
              justifyContent: 'center',
              borderRadius: radii.pill,
              borderWidth: 1.5,
              borderColor: selected ? colors.selection : colors.outline,
              backgroundColor: selected ? colors.selection : 'transparent',
              opacity: pressedOpacity(pressed),
            })}
          >
            {/* The door's old control, moved down: it keeps the door's text cap so the row
                stays one line of pills at large text. */}
            <Text
              maxFontSizeMultiplier={DOOR_MAX_SCALE}
              style={{
                color: selected ? colors.onSelection : colors.ink,
                fontSize: 15,
                fontWeight: '600',
                fontVariant: ['tabular-nums'],
              }}
            >
              {pill.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
