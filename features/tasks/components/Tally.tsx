import { Text, View } from 'react-native';
import type { TodayLine } from '@/domain/tasks/todayLine';
import { todayLineText } from '@/features/tasks/todayLineText';
import { useDoorCompact } from '@/ui/components/DoorHeader';
import { useTheme } from '@/ui/theme';
import { displayFont, displayFontBold } from '@/ui/tokens';

const LINE_SIZE = 17;
const NUMBER_SIZE = 20;

/**
 * The door line of Hoy: what is yours today (or the household's, or a member's), in Rounded 700
 * with the number in Rounded 800 a little larger and the same colour, and under it what is left
 * for the household. In a compact door (a phone on its side) only the first phrase shows.
 */
export function TallyView({ line }: { line: TodayLine }) {
  const { colors } = useTheme();
  const compact = useDoorCompact();
  const { first, number, second } = todayLineText(line);
  const label = second === null || compact ? first : `${first} ${second}`;

  // The count is the last number in the sentence (a name could hold digits, never the count's tail).
  const at = number === null ? -1 : first.lastIndexOf(number);
  const head = at < 0 ? first : first.slice(0, at);
  const tail = at < 0 ? '' : first.slice(at + (number?.length ?? 0));

  return (
    <View accessible accessibilityLabel={label} accessibilityLiveRegion="polite" style={{ gap: 2 }}>
      <Text
        style={{
          color: colors.ink,
          fontFamily: displayFontBold,
          fontSize: LINE_SIZE,
          fontVariant: ['tabular-nums'],
        }}
      >
        {head}
        {number !== null ? (
          <Text style={{ fontFamily: displayFont, fontSize: NUMBER_SIZE }}>{number}</Text>
        ) : null}
        {tail}
      </Text>
      {second !== null && !compact ? (
        <Text style={{ color: colors.muted, fontSize: 15 }}>{second}</Text>
      ) : null}
    </View>
  );
}
