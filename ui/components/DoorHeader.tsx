import { Children, createContext, useContext, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';
import { DOOR_MAX_SCALE, DOOR_TYPE, doorFor, type Door, type DoorType } from '../door';
import { useTheme } from '../theme';
import { displayFont, displayFontBold, MIN_TOUCH } from '../tokens';
import { useLayout } from '../useLayout';

/** True when a parent (FridgeRefresh) already paints the door colour under the status bar. */
export const DoorInsetContext = createContext(false);

export type FridgeRefreshValue = { refreshing: boolean; onRefresh: () => void };

/** Provided by FridgeRefresh: lets the door's handle refresh the pane it sits in. */
export const FridgeRefreshContext = createContext<FridgeRefreshValue | null>(null);

/** The refresh of the surrounding FridgeRefresh, or null when the screen has none. */
export function useFridgeRefresh(): FridgeRefreshValue | null {
  return useContext(FridgeRefreshContext);
}

const DoorCompactContext = createContext(false);
const DoorTypeContext = createContext<DoorType>(DOOR_TYPE.full);

/**
 * True inside a compact door (short window): the door's children have one row beside the
 * headline, so they should lay themselves out in a row (magnets, filter and counter side by side).
 */
export function useDoorCompact(): boolean {
  return useContext(DoorCompactContext);
}

/** How this window draws the door (`doorFor`): a screen asks it to know where its quick add goes. */
export function useDoor(): Door {
  const layout = useLayout();
  const { height, fontScale } = useWindowDimensions();
  return doorFor(layout, height, fontScale);
}

/** The sizes of the door this sits in (§14.4): full, or the same hierarchy smaller when compact. */
export function useDoorType(): DoorType {
  return useContext(DoorTypeContext);
}

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

type Props = {
  /**
   * The small label at the top (§14.4): the tab's name, in capitals. It is the door's header for
   * screen readers.
   */
  eyebrow: string;
  /** At the right of the eyebrow's row (Hoy: the date). */
  trailing?: ReactNode;
  /**
   * The door's headline. A string is drawn in the display face (`DoorHeadline`); a node is drawn
   * as is (Hoy: the today line; Ajustes: your magnet and editable name).
   */
  heading: ReactNode;
  /** With a string headline: its count, drawn a point larger («Faltan 4 cosas.»). */
  headingNumber?: string | null;
  /**
   * What a screen reader says for a node headline that does not say it itself. It makes the node
   * one element, so leave it out for a headline with controls inside (Ajustes' editable name).
   */
  headingText?: string;
  headingTestID?: string;
  /** The line under the headline. A string is drawn muted; any other node as is. */
  secondary?: ReactNode;
  secondaryTestID?: string;
  /** The controls (magnets, mode, field): stacked under the headline, or beside it when compact. */
  children?: ReactNode;
  /**
   * A full-width row under the headline and the controls (Tareas' day strip). In a compact door it
   * runs under the whole row, so the headline stays level with the controls beside it.
   */
  below?: ReactNode;
  /**
   * The quick add of the tab (Hoy, Tareas). Drawn under the controls only in a door that holds it
   * (`Door.holdsQuickAdd`, a phone on its side); anywhere else the screen draws it under the door.
   */
  quickAdd?: ReactNode;
};

/** Below this the children wrap under the headline instead of squeezing beside it. */
const COMPACT_CHILDREN_MIN = 240;
/** Seven one-line day cells («lun 18») side by side: below this the quick add wraps under them. */
const STRIP_MIN = 360;

/**
 * A door headline in the display face (Rounded 800, 32 on 38; 24 in a compact door), with its
 * count a point larger in the same colour. It grows with the phone's text size up to the door's
 * cap (`DOOR_MAX_SCALE`), so enlarged text never pushes the list off the screen.
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
      maxFontSizeMultiplier={DOOR_MAX_SCALE}
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

/**
 * The enamel door at the top of a main screen, with its handle on the bottom edge (it refreshes
 * the pane). Every tab shares its hierarchy (§14.4): the eyebrow, the headline, a muted line, then
 * the controls.
 *
 * The door's colour runs edge to edge; its content stays within `contentMax`, centred, so on a
 * wide screen it lines up with the panes below. On a short window (a phone on its side), or above
 * two panes when the full door would crowd them (`doorFor`), the door turns compact: the same
 * hierarchy smaller with the controls beside it, no handle, and never more than 40 % of the
 * window. If enlarged text still needs more, the door's content scrolls inside it rather than
 * being cut.
 */
export function DoorHeader({
  eyebrow,
  trailing,
  heading,
  headingNumber,
  headingText,
  headingTestID,
  secondary,
  secondaryTestID,
  children,
  below,
  quickAdd,
}: Props) {
  const { colors, radii, space } = useTheme();
  const insets = useSafeAreaInsets();
  const layout = useLayout();
  const door = useDoor();
  const { fontScale } = useWindowDimensions();
  const type = door.type;
  const { rail, contentMax, gutter } = layout;
  // Beside the rail, the rail already takes the left inset (a landscape notch).
  const left = rail ? 0 : insets.left;
  const insetHandled = useContext(DoorInsetContext);
  const top = insetHandled ? 0 : insets.top;
  const refresh = useFridgeRefresh();
  const handle = refresh !== null && door.handle;
  const right = gutter;

  // Only a compact door that cannot fit its content scrolls; otherwise its scroll stays off so a
  // pull on the door still reaches the list's pull-to-refresh.
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  const overflows = door.compact && viewport > 0 && content > viewport + 1;

  const eyebrowRow = (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        columnGap: space(3),
        marginBottom: space(1),
      }}
    >
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={DOOR_MAX_SCALE}
        style={{
          color: colors.muted,
          fontFamily: displayFontBold,
          fontSize: type.eyebrow,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
        }}
      >
        {eyebrow}
      </Text>
      {trailing}
    </View>
  );
  const headline =
    typeof heading === 'string' ? (
      <DoorHeadline text={heading} number={headingNumber} testID={headingTestID} />
    ) : headingText ? (
      <View testID={headingTestID} accessible accessibilityLabel={headingText}>
        {heading}
      </View>
    ) : (
      <View testID={headingTestID}>{heading}</View>
    );
  const sub =
    typeof secondary === 'string' && secondary !== '' ? (
      <Text
        testID={secondaryTestID}
        maxFontSizeMultiplier={DOOR_MAX_SCALE}
        style={{
          marginTop: space(1),
          color: colors.muted,
          fontSize: type.secondary,
          fontVariant: ['tabular-nums'],
        }}
      >
        {secondary}
      </Text>
    ) : secondary ? (
      <View testID={secondaryTestID} style={{ marginTop: space(1) }}>
        {secondary}
      </View>
    ) : null;
  const hierarchy = (
    <>
      {eyebrowRow}
      {headline}
      {sub}
    </>
  );

  const frame = {
    backgroundColor: colors.door,
    borderBottomLeftRadius: radii.door,
    borderBottomRightRadius: radii.door,
    paddingLeft: gutter + left,
    paddingRight: right + insets.right,
  };
  const column = { width: '100%', maxWidth: contentMax, alignSelf: 'center' } as const;

  if (door.compact) {
    // On a phone on its side the quick add comes into the door: beside the strip when there is
    // one (Tareas), under the controls otherwise (Hoy).
    const inDoor = door.holdsQuickAdd && quickAdd ? quickAdd : null;
    // The strip's cells grow with the text (up to the door's cap); past that width the quick add
    // takes a line of its own under the strip.
    const stripMin = STRIP_MIN * Math.min(Math.max(fontScale, 1), DOOR_MAX_SCALE);
    const controls = children || (inDoor && !below);
    const paddingTop = top + space(2);
    const paddingBottom = space(3);
    // The scroll's own cap: with only the outer maxHeight, Yoga laid the ScrollView out at its
    // content's height and the door clipped it instead of letting it scroll (Ajustes' line).
    const scrollMax =
      door.maxHeight === null
        ? undefined
        : Math.max(0, door.maxHeight - paddingTop - paddingBottom);
    return (
      <View
        style={{
          ...frame,
          maxHeight: door.maxHeight ?? undefined,
          paddingTop,
          paddingBottom,
        }}
      >
        <ScrollView
          style={{ flexGrow: 0, flexShrink: 1, maxHeight: scrollMax }}
          scrollEnabled={overflows}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={overflows}
          bounces={false}
          overScrollMode="never"
          nestedScrollEnabled
          onLayout={(e) => setViewport(e.nativeEvent.layout.height)}
          onContentSizeChange={(_, h) => setContent(h)}
        >
          <DoorCompactContext.Provider value>
            <DoorTypeContext.Provider value={type}>
              <View
                style={{
                  ...column,
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  columnGap: space(6),
                  rowGap: space(2),
                }}
              >
                <View
                  style={{ flexShrink: 1, ...(controls ? { maxWidth: '50%' } : { flexGrow: 1 }) }}
                >
                  {hierarchy}
                </View>
                {controls ? (
                  <View
                    style={{
                      flexGrow: 1,
                      flexShrink: 1,
                      flexBasis: 0,
                      minWidth: COMPACT_CHILDREN_MIN,
                    }}
                  >
                    {children}
                    {inDoor && !below ? (
                      <View style={{ marginTop: children ? space(2) : 0 }}>{inDoor}</View>
                    ) : null}
                  </View>
                ) : null}
              </View>
              {/* The ring around each magnet already leaves room, so the strip follows close. */}
              {below && inDoor ? (
                <View
                  style={{
                    ...column,
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    columnGap: space(6),
                    rowGap: space(2),
                  }}
                >
                  <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: stripMin }}>
                    {below}
                  </View>
                  <View
                    style={{
                      flexGrow: 1,
                      flexShrink: 1,
                      flexBasis: 0,
                      minWidth: COMPACT_CHILDREN_MIN,
                    }}
                  >
                    {inDoor}
                  </View>
                </View>
              ) : below ? (
                <View style={column}>{below}</View>
              ) : null}
            </DoorTypeContext.Provider>
          </DoorCompactContext.Provider>
        </ScrollView>
      </View>
    );
  }

  return (
    <View
      style={{
        ...frame,
        paddingTop: top + space(3),
        // With a handle the bottom padding is its 44 dp touch box, so the box is inside the door.
        paddingBottom: handle ? MIN_TOUCH : space(6),
      }}
    >
      {/* The handle only exists where it works: a door outside a refreshing pane has none. */}
      {refresh && handle ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            // A 44 x 44 touch target inside the door's bottom padding: Android drops taps that
            // reach past the parent, so only 2 dp of the bar overflow.
            bottom: 0,
            height: MIN_TOUCH,
            alignItems: 'center',
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('refresh.pull')}
            onPress={refresh.onRefresh}
            style={{
              width: MIN_TOUCH,
              height: MIN_TOUCH,
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}
          >
            {/* 36 x 4 drawn, sitting on the door's edge. */}
            <View
              style={{
                width: 36,
                height: 4,
                marginBottom: -2,
                borderRadius: radii.pill,
                backgroundColor: colors.outline,
              }}
            />
          </Pressable>
        </View>
      ) : null}
      <DoorTypeContext.Provider value={type}>
        <View style={column}>
          {hierarchy}
          {children ? <View style={{ marginTop: space(5) }}>{children}</View> : null}
          {below ? <View style={{ marginTop: space(4) }}>{below}</View> : null}
        </View>
      </DoorTypeContext.Provider>
    </View>
  );
}
