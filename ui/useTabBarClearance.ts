import { PixelRatio, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNoticeShown } from './components/noticeContext';
import { listEndPadding } from './noticeClearance';
import { tabBarClearance } from './tabBar';
import { useMeasuredTabBarHeight } from './tabBarHeight';
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
  const measured = useMeasuredTabBarHeight();
  return tabBarClearance({
    width,
    height,
    fontScale: PixelRatio.getFontScale(),
    bottomInset: bottom,
    rail,
    measured,
  });
}

/**
 * Room under the last item of a tab screen's list. The bottom bar already sits below the list,
 * so only a little air; beside the rail the list runs to the screen's edge and also clears the
 * home indicator. While a notice shows («Hecha. Deshacer») the pill's room is added, so the note
 * it would cover can scroll clear of it.
 */
export function useListEndPadding(): number {
  return listEndPadding(useBaseListEndPadding(), useNoticeShown());
}

/** The same room without any notice: what `noticeNudge` subtracts to find the last note. */
export function useBaseListEndPadding(): number {
  const { rail } = useLayout();
  const { bottom } = useSafeAreaInsets();
  return space(7) + (rail ? bottom : 0);
}
