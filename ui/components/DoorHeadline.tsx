import { Children, type ReactNode } from 'react';
import { Platform, Text, View } from 'react-native';
import { DOOR_HEADLINE_MAX_SCALE } from '../door';
import { useTheme } from '../theme';
import { displayFont } from '../tokens';
import { useDoorCompact, useDoorType } from './doorContext';

/**
 * The controls under a door's headline (magnets, filter, counter): stacked in a full door, side by
 * side in one row in a compact one. In that row each control keeps its natural width and a
 * control that does not fit beside the one before moves onto a line of its own, where it may
 * shrink (a counter wraps its text, a long filter scrolls). Nothing is squeezed to make room for
 * a neighbour, so enlarged text never runs over a magnet.
 *
 * `row` (Tareas: filter and mode) is one line that never wraps, in a full door or a compact one:
 * the first controls shrink (the filter scrolls) and the last keeps its width. A horizontal
 * ScrollView has no intrinsic width on Android, so in a wrapping row it took the whole line, the
 * switch wrapped under it and the row did not grow for that second line, painting the switch over
 * the day strip below.
 */
export function DoorControls({ children, row = false }: { children: ReactNode; row?: boolean }) {
  const { space } = useTheme();
  const compact = useDoorCompact();
  if (!compact && !row) return <View style={{ gap: space(4) }}>{children}</View>;
  if (row) {
    const items = Children.toArray(children);
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: space(5) }}>
        {items.map((child, i) => (
          <View
            key={i}
            style={i === items.length - 1 ? { flexShrink: 0 } : { flexShrink: 1, minWidth: 0 }}
          >
            {child}
          </View>
        ))}
      </View>
    );
  }
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        columnGap: space(5),
        rowGap: space(2),
      }}
    >
      {Children.toArray(children).map((child, i) => (
        <View key={i} style={{ flexShrink: 1, minWidth: 0, maxWidth: '100%' }}>
          {child}
        </View>
      ))}
    </View>
  );
}

/**
 * A door headline in the display face (Rounded 800, 32 on 38; 24 in a compact door), with its
 * count a point larger in the same colour. It grows with the phone's text size up to its own cap
 * (`DOOR_HEADLINE_MAX_SCALE`, a step above the rest of the door), so enlarged text never pushes the
 * list off the screen nor leaves the headline smaller than a note's title.
 */
export function DoorHeadline({
  text,
  number,
  testID,
}: {
  text: string;
  number?: string | null;
  testID?: string;
}) {
  const { colors } = useTheme();
  const type = useDoorType();
  // The count is the last number in the sentence (a name could hold digits, never the count's tail).
  const at = number ? text.lastIndexOf(number) : -1;
  const head = at < 0 ? text : text.slice(0, at);
  const tail = at < 0 || !number ? '' : text.slice(at + number.length);
  return (
    <Text
      testID={testID}
      maxFontSizeMultiplier={DOOR_HEADLINE_MAX_SCALE}
      style={{
        color: colors.ink,
        fontFamily: displayFont,
        fontSize: type.heading,
        lineHeight: type.lineHeight,
        letterSpacing: -type.heading * 0.02,
        fontVariant: ['tabular-nums'],
        ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
      }}
    >
      {head}
      {at >= 0 ? <Text style={{ fontSize: type.number }}>{number}</Text> : null}
      {tail}
    </Text>
  );
}
