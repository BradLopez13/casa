import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { oneColumn } from './panes';
import { useLayout } from './useLayout';

/**
 * The style of a one-column frame (`oneColumn`), centred: for each row, heading, empty state or
 * sheet of a list whose door scrolls with it, so the door can stay edge to edge while the content
 * keeps to the column. What sits inside brings no side padding of its own (`flush`). The same
 * object for as long as the frame holds, so list rows that take it do not re-render for nothing.
 */
export function useOneColumn() {
  const layout = useLayout();
  const insets = useSafeAreaInsets();
  const { paddingLeft, paddingRight, maxWidth } = oneColumn(layout, insets, layout.rail);
  return useMemo(
    () => ({ paddingLeft, paddingRight, maxWidth, width: '100%', alignSelf: 'center' }) as const,
    [paddingLeft, paddingRight, maxWidth],
  );
}
