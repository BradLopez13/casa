import { Pressable, Text, View } from 'react-native';
import type { MemberMark } from '@/domain/members/marks';
import { toLocalDate } from '@/domain/tasks/dates';
import { dayHeading } from '@/domain/tasks/labels';
import type { StripDay } from '@/domain/tasks/strip';
import { locale, t } from '@/i18n';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH, displayFont } from '@/ui/tokens';

type Props = {
  days: StripDay[];
  today: string;
  marks: Map<string, MemberMark>;
  /** Open tasks per day, for the accessible label. Days missing here count as 0. */
  counts: Map<string, number>;
  onSelect: (date: string) => void;
};

const DOT = 6;

/** The next seven days as flat cells, with a dot for each person who has something that day. */
export function DayStrip({ days, today, marks, counts, onSelect }: Props) {
  const { colors, radii, space } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space(1) }}>
      {days.map((day) => {
        const isToday = day.date === today;
        const date = toLocalDate(day.date);
        const count = counts.get(day.date) ?? 0;
        const heading = dayHeading(day.date, today);
        return (
          <Pressable
            key={day.date}
            testID={`day-strip.${day.date}`}
            accessibilityRole="button"
            accessibilityLabel={
              count === 1
                ? t('tasks.stripDayOne', { day: heading })
                : t('tasks.stripDay', { day: heading, count })
            }
            onPress={() => onSelect(day.date)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: MIN_TOUCH,
              alignItems: 'center',
              paddingVertical: space(2),
              gap: space(1),
              borderRadius: radii.day,
              backgroundColor: isToday ? colors.page : colors.door,
              borderWidth: 1,
              borderColor: isToday ? colors.page : colors.hairline,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              maxFontSizeMultiplier={1.3}
              numberOfLines={1}
              style={{ color: colors.muted, fontSize: 12 }}
            >
              {date.toLocaleDateString(locale, { weekday: 'short' })}
            </Text>
            <Text
              maxFontSizeMultiplier={1.3}
              style={{
                color: colors.ink,
                fontFamily: displayFont,
                fontSize: 18,
                fontVariant: ['tabular-nums'],
              }}
            >
              {date.getDate()}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 2,
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
                    borderColor: colors.outline,
                  }}
                />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
