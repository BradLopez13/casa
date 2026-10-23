import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { clearOf, hasMoreBelow } from '../moreBelow';
import { useTheme } from '../theme';

/**
 * Tracks whether a ScrollView still hides something under its bottom edge. The sizes live in a
 * ref and only the answer is state, so scrolling does not redraw the sheet at every frame.
 */
export function useMoreBelow() {
  const size = useRef({ content: 0, offset: 0, viewport: 0 });
  const [below, setBelow] = useState(false);
  const update = (next: Partial<typeof size.current>) => {
    size.current = { ...size.current, ...next };
    const { content, offset, viewport } = size.current;
    setBelow(hasMoreBelow(content, offset, viewport));
  };
  return {
    below,
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) =>
      update({ offset: event.nativeEvent.contentOffset.y }),
    onLayout: (event: LayoutChangeEvent) => update({ viewport: event.nativeEvent.layout.height }),
    onContentSizeChange: (_width: number, content: number) => update({ content }),
  };
}

/**
 * The page fading in over the last dp of a scroll that has more below, drawn right above a fixed
 * foot: what lies under it reads as cut on purpose, not lost (fase 10c). Decorative: no touch, and
 * the screen reader skips it.
 */
export function MoreBelowFade({ visible }: { visible: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {visible ? (
        <LinearGradient
          testID="more-below"
          colors={[clearOf(colors.page), colors.page]}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 32 }}
        />
      ) : null}
    </View>
  );
}
