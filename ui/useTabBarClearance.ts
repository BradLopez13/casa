import { PixelRatio, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tabBarClearance } from './tabBar';
import { space } from './theme';
import { useLayout } from './useLayout';

/**
 * Distance from the bottom edge that clears the tab bar (bottom bar with the safe area, or only
 * the inset beside the rail). Lives apart from `tabBar.ts` so that file stays free of
 * react-native imports and Vitest can load it.
 */
export function useTabBarClearance(): number {
  const { rail } = useLayout();
  const { width, height } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  return tabBarClearance({
    width,
    height,
    fontScale: PixelRatio.getFontScale(),
    bottomInset: bottom,
    rail,
  });
}

/**
 * Room under the last item of a tab screen's list. The bottom bar already sits below the list,
 * so only a little air; beside the rail the list runs to the screen's edge and also clears the
 * home indicator.
 */
export function useListEndPadding(): number {
  const { rail } = useLayout();
  const { bottom } = useSafeAreaInsets();
  return space(7) + (rail ? bottom : 0);
}
