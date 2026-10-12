import type { ReactElement, ReactNode } from 'react';
import {
  ScrollView,
  View,
  type RefreshControlProps,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
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
  // Passed to every scroll (one in stack, one per pane in split), so FridgeRefresh can wrap a
  // TwoPane the same way it wraps a ScrollView, and forms keep their taps with the keyboard up.
  refreshControl?: ReactElement<RefreshControlProps>;
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
  contentContainerStyle?: StyleProp<ViewStyle>;
  contentInsetAdjustmentBehavior?: ScrollViewProps['contentInsetAdjustmentBehavior'];
};

/**
 * Two panes in a 60/40 split from `expanded`, each with its own scroll, the pair kept within
 * `contentMax` and centred. Below `expanded`, one column: `left` then `right` in a single scroll.
 *
 * TwoPane owns the side gutter in both modes; pane content brings no horizontal padding of its
 * own (on a compact phone the gutter is the 20 dp the screens use today).
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
  const { contentMax, gutter, size } = layout;
  const scrollProps = {
    refreshControl,
    keyboardShouldPersistTaps,
    contentContainerStyle,
    contentInsetAdjustmentBehavior,
  };

  if (paneMode(layout) === 'stack') {
    return (
      <ScrollView {...scrollProps}>
        {header}
        <View
          style={{
            width: '100%',
            maxWidth: contentMax + gutter * 2,
            alignSelf: 'center',
            paddingHorizontal: gutter,
          }}
        >
          <View testID={leftTestID}>{left}</View>
          <View testID={rightTestID}>{right}</View>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {header}
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          width: '100%',
          maxWidth: contentMax + gutter * 2,
          alignSelf: 'center',
          paddingHorizontal: gutter,
          gap: paneGap(size),
        }}
      >
        <ScrollView testID={leftTestID} style={{ flex: 3 }} {...scrollProps}>
          {left}
        </ScrollView>
        <ScrollView testID={rightTestID} style={{ flex: 2 }} {...scrollProps}>
          {right}
        </ScrollView>
      </View>
    </View>
  );
}
