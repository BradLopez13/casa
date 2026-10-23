import { useContext, useState, type ReactNode } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHint } from '@/features/hints/hints';
import { t } from '@/i18n';
import { DOOR_MAX_SCALE } from '../door';
import { doorEdge } from '../positEdge';
import { useTheme } from '../theme';
import { displayFontBold, MIN_TOUCH } from '../tokens';
import { useLayout } from '../useLayout';
import {
  DoorCompactContext,
  DoorInsetContext,
  DoorTypeContext,
  useDoor,
  useFridgeRefresh,
} from './doorContext';
import { DoorHandle } from './DoorHandle';
import { DoorHeadline } from './DoorHeadline';
import { FirstUseHint } from './FirstUseHint';

// The door's pieces live beside it; screens keep importing them from here.
export {
  DoorInsetContext,
  FridgeRefreshContext,
  useDoor,
  useDoorCompact,
  useDoorType,
  useFridgeRefresh,
  type FridgeRefreshValue,
} from './doorContext';
export { DoorControls, DoorHeadline } from './DoorHeadline';

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
  // The handle's hint waits for the box and the quick add ones: the first days are for ticking
  // things off and writing them down, and at large text three hints left no note in view.
  const refreshOpen = useHint('refresh');
  const boxOpen = useHint('complete');
  const quickAddOpen = useHint('quickAdd');
  const refreshHint = refreshOpen && !boxOpen && !quickAddOpen && handle;
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

  // With high contrast in light the enamel and the paper are 1.32:1: the door draws its edge.
  const edge = doorEdge(colors);
  const frame = {
    backgroundColor: colors.door,
    borderBottomLeftRadius: radii.door,
    borderBottomRightRadius: radii.door,
    paddingLeft: gutter + left,
    paddingRight: right + insets.right,
  };
  const column = { width: '100%', maxWidth: contentMax, alignSelf: 'center' } as const;
  // The high-contrast edge as a layer over the door's bottom curve, not a border of the door
  // itself: on Android a border on the door's background left a seam along its top edge.
  const edgeLayer = edge ? (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: radii.door,
        borderBottomWidth: edge.width,
        borderLeftWidth: edge.width,
        borderRightWidth: edge.width,
        borderColor: edge.color,
        borderBottomLeftRadius: radii.door,
        borderBottomRightRadius: radii.door,
        borderTopWidth: 0,
      }}
    />
  ) : null;

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
        {edgeLayer}
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
                {/* Beside the controls on a short window or above two panes; on a phone held
                    upright (large text) there is no room beside, so it takes the full width and
                    the controls go under it (fase 10b). */}
                <View
                  style={{
                    flexShrink: 1,
                    ...(controls && door.beside
                      ? { maxWidth: '50%' }
                      : { flexGrow: 1, flexBasis: '100%' }),
                  }}
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
      {edgeLayer}
      {/* The handle only exists where it works: a door outside a refreshing pane has none. */}
      {refresh && handle ? <DoorHandle onRefresh={refresh.onRefresh} /> : null}
      <DoorTypeContext.Provider value={type}>
        <View style={column}>
          {hierarchy}
          {children ? <View style={{ marginTop: space(5) }}>{children}</View> : null}
          {below ? <View style={{ marginTop: space(4) }}>{below}</View> : null}
          {refreshHint ? (
            <View style={{ marginTop: space(4) }}>
              <FirstUseHint
                testID="door.refresh-hint"
                text={t('refresh.hint')}
                readerText={t('refresh.hintReader')}
                arrow="arrow-down"
                align="center"
                door
              />
            </View>
          ) : null}
        </View>
      </DoorTypeContext.Provider>
    </View>
  );
}
