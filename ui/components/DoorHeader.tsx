import { Children, createContext, useContext, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';
import { doorFor, type DoorTitleSize } from '../door';
import { useTheme } from '../theme';
import { displayFont } from '../tokens';
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

/**
 * True inside a compact door (short window): the door's children have one row beside the title,
 * so they should lay themselves out in a row (magnets, filter and counter side by side).
 */
export function useDoorCompact(): boolean {
  return useContext(DoorCompactContext);
}

/**
 * The controls under a door's title (magnets, filter, counter): stacked in a full door, side by
 * side in one row in a compact one. In that row each control keeps its natural width and a
 * control that does not fit beside the one before moves onto a line of its own, where it may
 * shrink (a counter wraps its text, a long filter scrolls). Nothing is squeezed to make room for
 * a neighbour, so enlarged text never runs over a magnet.
 */
export function DoorControls({ children }: { children: ReactNode }) {
  const { space } = useTheme();
  const compact = useDoorCompact();
  if (!compact) return <View style={{ gap: space(4) }}>{children}</View>;
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
  title: string;
  /**
   * The small label above the headline (§14.4), for a door whose headline is not the screen's
   * name (Ajustes: «Ajustes» over your name). It is then the door's header for screen readers.
   */
  eyebrow?: string;
  /** Replaces the title text with a node of its own (Ajustes: your magnet and editable name). */
  heading?: ReactNode;
  /** A string is painted in the muted subtitle style; any other node is painted as is. */
  subtitle?: ReactNode;
  /** 'large' for Hoy (44), 'medium' for Tareas (38). Both are 28 in a compact door. */
  titleSize?: DoorTitleSize;
  titleTestID?: string;
  children?: ReactNode;
  /**
   * A short status line (Hoy's tally). In a full door it follows the controls; in a compact one
   * it sits beside the title, inside the title's column, so it never competes with the magnets
   * for the row and is never pushed below the door's 40 % height budget.
   */
  status?: ReactNode;
  /**
   * A full-width row under the title and the controls (Tareas' day strip). In a full door it
   * follows the controls; in a compact one it runs under the whole row, so the title stays level
   * with the controls beside it.
   */
  below?: ReactNode;
};

/** Below this the children wrap under the title instead of squeezing beside it. */
const COMPACT_CHILDREN_MIN = 240;

/**
 * The enamel door at the top of a main screen, with its handle on the bottom edge (it refreshes the pane).
 *
 * The door's colour runs edge to edge; its content stays within `contentMax`, centred, so on a
 * wide screen it lines up with the panes below. On a short window (a phone on its side), or above
 * two panes when the full door would crowd them (`doorFor`), the door turns compact: a smaller
 * title with the controls beside it, no handle, and never more than 40 % of the window. If
 * enlarged text still needs more, the door's content scrolls inside it rather than being cut.
 */
export function DoorHeader({
  title,
  eyebrow,
  heading: customHeading,
  subtitle,
  titleSize = 'large',
  titleTestID,
  children,
  status,
  below,
}: Props) {
  const { colors, radii, space } = useTheme();
  const insets = useSafeAreaInsets();
  const layout = useLayout();
  const { height, fontScale } = useWindowDimensions();
  const door = doorFor(layout, height, titleSize, fontScale);
  const { rail, contentMax, gutter } = layout;
  // Beside the rail, the rail already takes the left inset (a landscape notch).
  const left = rail ? 0 : insets.left;
  const insetHandled = useContext(DoorInsetContext);
  const top = insetHandled ? 0 : insets.top;
  const refresh = useFridgeRefresh();
  const right = gutter;

  // Only a compact door that cannot fit its content scrolls; otherwise its scroll stays off so a
  // pull on the door still reaches the list's pull-to-refresh.
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  const overflows = door.compact && viewport > 0 && content > viewport + 1;

  const size = door.titleSize;
  const label = eyebrow ? (
    <Text
      accessibilityRole="header"
      style={{
        marginBottom: space(1),
        color: colors.muted,
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}
    >
      {eyebrow}
    </Text>
  ) : null;
  const titleText = customHeading ?? (
    <Text
      testID={titleTestID}
      accessibilityRole="header"
      maxFontSizeMultiplier={1.3}
      style={{
        color: colors.ink,
        fontFamily: displayFont,
        fontSize: size,
        lineHeight: Math.round(size * 1.15),
        letterSpacing: -size * 0.025,
        ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
      }}
    >
      {title}
    </Text>
  );
  const heading = label ? (
    <View>
      {label}
      {titleText}
    </View>
  ) : (
    titleText
  );
  const sub =
    typeof subtitle === 'string' && subtitle !== '' ? (
      <Text
        style={{
          marginTop: space(1),
          color: colors.muted,
          fontSize: 15,
          fontVariant: ['tabular-nums'],
        }}
      >
        {subtitle}
      </Text>
    ) : subtitle ? (
      <View style={{ marginTop: space(1) }}>{subtitle}</View>
    ) : null;

  const frame = {
    backgroundColor: colors.door,
    borderBottomLeftRadius: radii.door,
    borderBottomRightRadius: radii.door,
    paddingLeft: gutter + left,
    paddingRight: right + insets.right,
  };
  const column = { width: '100%', maxWidth: contentMax, alignSelf: 'center' } as const;

  if (door.compact) {
    return (
      <View
        style={{
          ...frame,
          maxHeight: door.maxHeight ?? undefined,
          paddingTop: top + space(2),
          paddingBottom: space(3),
        }}
      >
        <ScrollView
          style={{ flexGrow: 0, flexShrink: 1 }}
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
              <View style={{ flexShrink: 1, maxWidth: '50%' }}>
                {status ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      alignItems: 'baseline',
                      columnGap: space(4),
                    }}
                  >
                    {heading}
                    {status}
                  </View>
                ) : (
                  heading
                )}
                {sub}
              </View>
              {children ? (
                <View
                  style={{
                    flexGrow: 1,
                    flexShrink: 1,
                    flexBasis: 0,
                    minWidth: COMPACT_CHILDREN_MIN,
                  }}
                >
                  {children}
                </View>
              ) : null}
            </View>
            {/* The ring around each magnet already leaves room, so the strip follows close. */}
            {below ? <View style={column}>{below}</View> : null}
          </DoorCompactContext.Provider>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ ...frame, paddingTop: top + space(3), paddingBottom: space(6) }}>
      {/* The handle only exists where it works: a door outside a refreshing pane has none. */}
      {refresh && door.handle ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            // Centred on the door's bottom edge.
            bottom: -2,
            alignItems: 'center',
            zIndex: 1,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('refresh.pull')}
            // 36 x 4 drawn, 44 x 44 to touch.
            hitSlop={{ top: 20, bottom: 20, left: 4, right: 4 }}
            onPress={refresh.onRefresh}
            style={{
              width: 36,
              height: 4,
              borderRadius: radii.pill,
              backgroundColor: colors.outline,
            }}
          />
        </View>
      ) : null}
      <View style={column}>
        {heading}
        {sub}
        {children ? <View style={{ marginTop: space(5) }}>{children}</View> : null}
        {status ? <View style={{ marginTop: space(children ? 4 : 5) }}>{status}</View> : null}
        {below ? <View style={{ marginTop: space(4) }}>{below}</View> : null}
      </View>
    </View>
  );
}
