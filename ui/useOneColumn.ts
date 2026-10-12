import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clearRightLane, columnRoom, oneColumn } from './panes';
import { useLayout } from './useLayout';

/**
 * The style of a one-column frame (`oneColumn`), centred: for each row, heading, empty state or
 * sheet of a list whose door scrolls with it, so the door can stay edge to edge while the content
 * keeps to the column. What sits inside brings no side padding of its own (`flush`). The same
 * object for as long as the frame holds, so list rows that take it do not re-render for nothing.
 *
 * `rightLane` keeps the content that many dp clear of the screen's right edge (`clearRightLane`),
 * for a list under the round "+" of a short window; 0, the default, leaves the frame as it is.
 */
export function useOneColumn(rightLane = 0) {
  const layout = useLayout();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { paddingLeft, paddingRight, maxWidth } = clearRightLane(
    oneColumn(layout, insets, layout.rail),
    columnRoom(width, layout.rail, insets.left),
    rightLane,
  );
  return useMemo(
    () => ({ paddingLeft, paddingRight, maxWidth, width: '100%', alignSelf: 'center' }) as const,
    [paddingLeft, paddingRight, maxWidth],
  );
}
