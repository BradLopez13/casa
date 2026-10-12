import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import type { MemberMark } from '@/domain/members/marks';
import { toLocalDate } from '@/domain/tasks/dates';
import { dayName } from '@/domain/tasks/labels';
import type { StripDay } from '@/domain/tasks/strip';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH, displayFont } from '@/ui/tokens';
import { DayDots, dayCountLabel } from './DayStrip';

type Props = {
  /** The same seven days as the strip (`weekStrip`). */
  days: StripDay[];
  /** The chosen day; its row is filled. */
  selected: string;
  onSelect: (date: string) => void;
  today: string;
  marks: Map<string, MemberMark>;
};

/** Wide enough for "30" in the display face, so the names start on one line. */
const NUMBER_COLUMN = 32;

/**
 * The seven days stacked, for the left pane of Semana on a wide screen: day number, name, who has
 * something that day and how many open tasks. The chosen day is a filled block, the rest sit
 * flat on the page, so the choice reads by shape as well as colour.
 */
export function DayList({ days, selected, onSelect, today, marks }: Props) {
  const { colors, radii, space } = useTheme();
  // Name and count grow with the system text; once a name may run to two lines, the number sits
  // level with its first line instead of floating in the middle.
  const align = useWindowDimensions().fontScale > 1.3 ? 'flex-start' : 'center';
  return (
    <View style={{ gap: space(1) }}>
      {days.map((day) => {
        const isSelected = day.date === selected;
        const isToday = day.date === today;
        const ink = isSelected ? colors.onCobalt : colors.ink;
        const quiet = isSelected ? colors.onCobalt : colors.muted;
        return (
          <Pressable
            key={day.date}
            testID={`day-list.${day.date}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={dayCountLabel(day, today)}
            onPress={() => onSelect(day.date)}
            style={({ pressed }) => ({
              minHeight: MIN_TOUCH,
              flexDirection: 'row',
              alignItems: align,
              gap: space(3),
              paddingVertical: space(2),
              paddingHorizontal: space(3),
              borderRadius: radii.day,
              backgroundColor: isSelected ? colors.cobalt : 'transparent',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              maxFontSizeMultiplier={1.3}
              style={{
                minWidth: NUMBER_COLUMN,
                textAlign: 'center',
                color: ink,
                fontFamily: displayFont,
                fontSize: 20,
                fontVariant: ['tabular-nums'],
              }}
            >
              {toLocalDate(day.date).getDate()}
            </Text>
            <View style={{ flex: 1, alignItems: 'flex-start', gap: space(1) }}>
              <Text
                style={{
                  color: ink,
                  fontSize: 16,
                  // Today keeps the strip's bold weekday; the chosen day is bold for its fill.
                  fontWeight: isToday || isSelected ? '700' : '400',
                }}
              >
                {dayName(day.date, today)}
              </Text>
              {day.people.length > 0 || day.unassigned ? (
                <DayDots day={day} marks={marks} ring={isSelected ? colors.onCobalt : undefined} />
              ) : null}
            </View>
            <Text
              style={{
                color: day.count > 0 ? ink : quiet,
                fontSize: 16,
                fontWeight: '600',
                fontVariant: ['tabular-nums'],
              }}
            >
              {day.count}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
