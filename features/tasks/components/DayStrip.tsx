import { Pressable, Text, View } from 'react-native';
import type { MemberMark } from '@/domain/members/marks';
import { toLocalDate } from '@/domain/tasks/dates';
import { dayHeading } from '@/domain/tasks/labels';
import type { StripDay } from '@/domain/tasks/strip';
import { locale, t } from '@/i18n';
import { useDoorCompact } from '@/ui/components/DoorHeader';
import { pressedOpacity } from '@/ui/buttonLook';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH, displayFont } from '@/ui/tokens';

type Props = {
  days: StripDay[];
  today: string;
  marks: Map<string, MemberMark>;
  onSelect: (date: string) => void;
};

const DOT = 6;

/** "Hoy, 3 tareas": what a day cell or row says to a screen reader. */
export function dayCountLabel(day: StripDay, today: string): string {
  const heading = dayHeading(day.date, today);
  return day.count === 1
    ? t('tasks.stripDayOne', { day: heading })
    : t('tasks.stripDay', { day: heading, count: day.count });
}

type DotsProps = {
  day: StripDay;
  marks: Map<string, MemberMark>;
  /** Ring each dot in this colour, for dots that sit on a filled (selected) background. */
  ring?: string;
};

/** One dot per person with something that day, plus a dashed one for unassigned tasks. */
export function DayDots({ day, marks, ring }: DotsProps) {
  const { colors, space } = useTheme();
  const edge = ring ? { borderWidth: 1, borderColor: ring } : null;
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: space(0.5),
        minHeight: DOT,
      }}
    >
      {day.people.map((id) => {
        const mark = marks.get(id);
        if (!mark) return null;
        return (
          <View
            key={id}
            style={{
              width: DOT,
              height: DOT,
              borderRadius: DOT / 2,
              backgroundColor: colors.magnet[mark.color],
              ...edge,
            }}
          />
        );
      })}
      {day.unassigned ? (
        <View
          style={{
            width: DOT,
            height: DOT,
            borderRadius: DOT / 2,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: ring ?? colors.outline,
          }}
        />
      ) : null}
    </View>
  );
}

/**
 * The next seven days as flat cells, with a dot for each person who has something that day. In a
 * compact door (a phone on its side) each cell is one line, weekday and number side by side, so
 * the strip takes a single row of touch height.
 */
export function DayStrip({ days, today, marks, onSelect }: Props) {
  const { colors, radii, space } = useTheme();
  const compact = useDoorCompact();
  return (
    <View style={{ flexDirection: 'row', gap: space(1) }}>
      {days.map((day) => {
        const isToday = day.date === today;
        const date = toLocalDate(day.date);
        return (
          <Pressable
            key={day.date}
            testID={`day-strip.${day.date}`}
            accessibilityRole="button"
            accessibilityLabel={dayCountLabel(day, today)}
            onPress={() => onSelect(day.date)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: MIN_TOUCH,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: compact ? space(1) : space(2),
              gap: space(1),
              borderRadius: radii.day,
              // Only today is cut out of the door, in the page colour, and its weekday is set in
              // bold ink: the cell stands out by weight as well as tone. The other days need no
              // box; their aligned columns already read as a week.
              backgroundColor: isToday ? colors.page : 'transparent',
              opacity: pressedOpacity(pressed),
            })}
          >
            <View
              style={
                compact
                  ? { flexDirection: 'row', alignItems: 'baseline', columnGap: space(1) }
                  : { alignItems: 'center', gap: space(1) }
              }
            >
              <Text
                numberOfLines={1}
                style={{
                  color: isToday ? colors.ink : colors.muted,
                  fontSize: 12,
                  fontWeight: isToday ? '700' : '400',
                }}
              >
                {date.toLocaleDateString(locale, { weekday: 'short' })}
              </Text>
              <Text
                style={{
                  color: colors.ink,
                  fontFamily: displayFont,
                  fontSize: compact ? 16 : 18,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {date.getDate()}
              </Text>
            </View>
            <DayDots day={day} marks={marks} />
          </Pressable>
        );
      })}
    </View>
  );
}
