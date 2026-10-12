import type { ReactElement, ReactNode } from 'react';
import {
  ScrollView,
  View,
  type RefreshControlProps,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { paneGap } from '../layout';
import { paneMode } from '../panes';
import { useLayout } from '../useLayout';

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
};

/**
 * Two panes in a 60/40 split from `expanded`, each with its own scroll, the pair kept within
 * `contentMax` and centred. Below `expanded`, one column: `left` then `right` in a single scroll.
 *
 * TwoPane owns the side gutter in both modes, plus the side safe areas (a phone on its side);
 * beside the rail, the rail already takes the left one. Pane content brings no horizontal padding
 * of its own (on a compact phone the gutter is the 20 dp the screens use today).
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
}: Props) {
  const layout = useLayout();
  const insets = useSafeAreaInsets();
  const { contentMax, gutter, size, rail } = layout;
  const paddingLeft = gutter + (rail ? 0 : insets.left);
  const paddingRight = gutter + insets.right;
  const column = {
    width: '100%',
    maxWidth: contentMax + paddingLeft + paddingRight,
    alignSelf: 'center',
    paddingLeft,
    paddingRight,
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

  return (
    <View style={{ flex: 1 }}>
      {header}
      <View style={{ ...column, flex: 1, flexDirection: 'row', gap: paneGap(size) }}>
        <ScrollView
          testID={leftTestID}
          style={{ flex: 3 }}
          refreshControl={refreshControl}
          {...scrollProps}
        >
          {left}
        </ScrollView>
        <ScrollView testID={rightTestID} style={{ flex: 2 }} {...scrollProps}>
          {right}
        </ScrollView>
      </View>
    </View>
  );
}
