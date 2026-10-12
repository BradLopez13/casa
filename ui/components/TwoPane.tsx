import { useState, type ReactElement, type ReactNode } from 'react';
import {
  Platform,
  ScrollView,
  View,
  useWindowDimensions,
  type RefreshControlProps,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FocusRevealContext } from '../focusReveal';
import { paneGap } from '../layout';
import {
  clearRightLane,
  columnRoom,
  paneColumn,
  paneFlex,
  paneMode,
  paneWidths,
  type WidePane,
} from '../panes';
import { useLayout } from '../useLayout';
import { useRevealFocusedField } from '../useRevealFocusedField';

type Props = {
  left: ReactNode;
  right: ReactNode;
  leftTestID?: string;
  rightTestID?: string;
  /**
   * Full-width top of the screen (the door). Split: fixed above both panes. Stack: the first item
   * of the single scroll, so it scrolls away exactly as it does today.
   */
  header?: ReactNode;
  /**
   * Stack: on the single scroll, so FridgeRefresh can wrap a TwoPane the way it wraps a
   * ScrollView. Split: on the left pane only, so a refresh shows one spinner, not two.
   */
  refreshControl?: ReactElement<RefreshControlProps>;
  // Passed to every scroll (one in stack, one per pane in split): forms keep their taps with the
  // keyboard up, and every pane keeps the bottom room the screen asks for.
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
  contentContainerStyle?: StyleProp<ViewStyle>;
  contentInsetAdjustmentBehavior?: ScrollViewProps['contentInsetAdjustmentBehavior'];
  /**
   * Whether the rail sits to the left, and so already takes the left safe area. Defaults to the
   * layout's `rail` (the tab screens); a screen outside the tabs passes false, as no rail is
   * drawn there, to keep clear of a side notch itself.
   */
  besideRail?: boolean;
  /** Which pane takes 60 % in split; the left one unless the screen says otherwise. */
  wide?: WidePane;
  /**
   * Split: the left pane keeps a focused field (and the block it reveals) above the keyboard, as
   * the forms do, for a screen whose field sits in that pane (Compra). In one column the screen
   * handles its own field.
   */
  revealFocusedField?: boolean;
  /**
   * Dp from the screen's right edge the panes' content keeps clear of (`clearRightLane`): the
   * round "+" of a short window floats there. 0, the default, leaves the frame as it is.
   */
  rightLane?: number;
};

/**
 * Two panes in a 60/40 split from `expanded` (`wide` picks the side that gets 60), each with its
 * own scroll, the pair kept within `contentMax` and centred. Below `expanded`, one column: `left`
 * then `right` in a single scroll.
 *
 * TwoPane owns the side gutter in both modes, plus the side safe areas (a phone on its side);
 * beside the rail, the rail already takes the left one (`paneColumn`). Pane content brings no
 * horizontal padding of its own (on a compact phone the gutter is the 20 dp the screens use today).
 */
export function TwoPane({
  left,
  right,
  leftTestID,
  rightTestID,
  header,
  refreshControl,
  keyboardShouldPersistTaps,
  contentContainerStyle,
  contentInsetAdjustmentBehavior,
  besideRail,
  wide,
  revealFocusedField = false,
  rightLane = 0,
}: Props) {
  const layout = useLayout();
  const flex = paneFlex(wide);
  const { scroll: revealScroll, reveal } = useRevealFocusedField();
  // The row's width inside its padding, once laid out: the panes then get explicit widths.
  const [inner, setInner] = useState<number | null>(null);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const nextToRail = besideRail ?? layout.rail;
  const column = {
    ...clearRightLane(
      paneColumn(layout, insets, nextToRail),
      columnRoom(windowWidth, nextToRail, insets.left),
      rightLane,
    ),
    width: '100%',
    alignSelf: 'center',
  } as const;
  const scrollProps = {
    keyboardShouldPersistTaps,
    contentContainerStyle,
    contentInsetAdjustmentBehavior,
  };

  if (paneMode(layout) === 'stack') {
    return (
      <ScrollView refreshControl={refreshControl} {...scrollProps}>
        {header}
        <View style={column}>
          <View testID={leftTestID}>{left}</View>
          <View testID={rightTestID}>{right}</View>
        </View>
      </ScrollView>
    );
  }

  const gap = paneGap(layout.size);
  const widths = inner === null ? null : paneWidths(inner, gap, wide);
  return (
    <View style={{ flex: 1 }}>
      {header}
      <View
        style={{ ...column, flex: 1, flexDirection: 'row', gap }}
        onLayout={(e) =>
          setInner(e.nativeEvent.layout.width - column.paddingLeft - column.paddingRight)
        }
      >
        <ScrollView
          testID={leftTestID}
          style={paneStyle(widths?.left, flex.left)}
          refreshControl={refreshControl}
          {...scrollProps}
          {...(revealFocusedField
            ? {
                ...revealScroll,
                // Nothing shrinks a pane for the keyboard on iOS: the inset gives it room to
                // scroll the field above it. Android resizes the window instead.
                automaticallyAdjustKeyboardInsets: Platform.OS === 'ios',
              }
            : null)}
        >
          {revealFocusedField ? (
            <FocusRevealContext.Provider value={reveal}>{left}</FocusRevealContext.Provider>
          ) : (
            left
          )}
        </ScrollView>
        <ScrollView
          testID={rightTestID}
          style={paneStyle(widths?.right, flex.right)}
          {...scrollProps}
        >
          {right}
        </ScrollView>
      </View>
    </View>
  );
}

/**
 * A pane's width: the measured share once the row is laid out, and until then the flex weight
 * spelt out in full (grow from a zero basis), never the `flex` shorthand, which Android was seen
 * to size by content, leaving both panes equal.
 */
function paneStyle(width: number | undefined, weight: number): ViewStyle {
  return width === undefined
    ? { flexGrow: weight, flexShrink: 1, flexBasis: 0 }
    : { width, flexGrow: 0, flexShrink: 0 };
}
