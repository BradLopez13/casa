import { Pressable, Text, View } from 'react-native';
import type { MemberMark } from '@/domain/members/marks';
import { toLocalDate } from '@/domain/tasks/dates';
import { dayCountLabel, type StripDay } from '@/domain/tasks/strip';
import { locale } from '@/i18n';
import { useDoorCompact } from '@/ui/components/DoorHeader';
import { pressedOpacity } from '@/ui/buttonLook';
import { DOOR_MAX_SCALE } from '@/ui/door';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH, displayFont } from '@/ui/tokens';

type Props = {
  days: StripDay[];
  today: string;
  /** The day the list is showing; filled with `selection`. */
  chosen: string;
  marks: Map<string, MemberMark>;
  names: Map<string, string>;
  onSelect: (date: string) => void;
};

const DOT = 6;
const TODAY_MARK = 3;

type DotsProps = {
  day: StripDay;
  marks: Map<string, MemberMark>;
  /** Ring each dot in this colour, for dots that sit on a filled (selected) background. */
  ring?: string;
};

/** One dot per person with something that day, plus an empty ring for unassigned tasks. */
export function DayDots({ day, marks, ring }: DotsProps) {
  const { colors, space } = useTheme();
  const edge = ring
    ? { borderWidth: 1, borderColor: ring }
    : { borderWidth: 1, borderColor: colors.magnetInk };
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
export function DayStrip({ days, today, chosen, marks, names, onSelect }: Props) {
  const { colors, radii, space } = useTheme();
  const compact = useDoorCompact();
  return (
    <View style={{ flexDirection: 'row', gap: space(1) }}>
      {days.map((day) => {
        const isToday = day.date === today;
        const isChosen = day.date === chosen;
        const ink = isChosen ? colors.onSelection : colors.ink;
        const date = toLocalDate(day.date);
        return (
          <Pressable
            key={day.date}
            testID={`day-strip.${day.date}`}
            accessibilityRole="button"
            accessibilityLabel={dayCountLabel(day, today, names)}
            accessibilityState={{ selected: isChosen }}
            onPress={() => onSelect(day.date)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: MIN_TOUCH,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: compact ? space(1) : space(2),
              gap: space(1),
              borderRadius: radii.pill,
              // The chosen day is filled with `selection`, whatever day it is. Today is only
              // marked by a bold weekday and a 3 dp underline, so it never reads as a hole.
              backgroundColor: isChosen ? colors.selection : 'transparent',
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
                maxFontSizeMultiplier={DOOR_MAX_SCALE}
                style={{
                  color: isChosen || isToday ? ink : colors.muted,
                  fontSize: 12,
                  fontWeight: isToday || isChosen ? '700' : '400',
                }}
              >
                {date.toLocaleDateString(locale, { weekday: 'short' })}
              </Text>
              <Text
                maxFontSizeMultiplier={DOOR_MAX_SCALE}
                style={{
                  color: ink,
                  fontFamily: displayFont,
                  fontSize: compact ? 16 : 18,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {date.getDate()}
              </Text>
              {isToday ? (
                <View
                  style={{
                    height: TODAY_MARK,
                    alignSelf: 'stretch',
                    borderRadius: TODAY_MARK / 2,
                    backgroundColor: isChosen ? colors.onSelection : colors.selection,
                  }}
                />
              ) : null}
            </View>
            <DayDots day={day} marks={marks} ring={isChosen ? colors.onSelection : undefined} />
          </Pressable>
        );
      })}
    </View>
  );
}
