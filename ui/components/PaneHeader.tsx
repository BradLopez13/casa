import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { paneColumn } from '../panes';
import { useTheme } from '../theme';
import { useLayout } from '../useLayout';

/**
 * The top of a plain screen built on TwoPane (a title, a back button): it lines up with the panes
 * below it, on the same gutter and safe areas, and keeps the room `Screen` gave above and below a
 * title. Pass it as TwoPane's `header`, with the same `besideRail`.
 */
export function PaneHeader({
  children,
  besideRail,
}: {
  children: ReactNode;
  besideRail?: boolean;
}) {
  const { space } = useTheme();
  const layout = useLayout();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        ...paneColumn(layout, insets, besideRail ?? layout.rail),
        width: '100%',
        alignSelf: 'center',
        paddingTop: space(6),
        paddingBottom: space(4),
        gap: space(4),
      }}
    >
      {children}
    </View>
  );
}
