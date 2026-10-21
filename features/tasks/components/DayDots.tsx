import { View } from 'react-native';
import type { MemberMark } from '@/domain/members/marks';
import type { StripDay } from '@/domain/tasks/strip';
import { useTheme } from '@/ui/theme';

const DOT = 6;

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
