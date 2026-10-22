import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { hasMoreBelow } from '../moreBelow';
import { useTheme } from '../theme';

/** Tracks whether a ScrollView still hides something under its bottom edge. */
export function useMoreBelow() {
  const [size, setSize] = useState({ content: 0, offset: 0, viewport: 0 });
  return {
    below: hasMoreBelow(size.content, size.offset, size.viewport),
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.y;
      setSize((s) => (s.offset === offset ? s : { ...s, offset }));
    },
    onLayout: (event: LayoutChangeEvent) => {
      const viewport = event.nativeEvent.layout.height;
      setSize((s) => (s.viewport === viewport ? s : { ...s, viewport }));
    },
    onContentSizeChange: (_width: number, content: number) =>
      setSize((s) => (s.content === content ? s : { ...s, content })),
  };
}

/**
 * The page fading in over the last dp of a scroll that has more below: what lies under the fixed
 * foot of a sheet reads as cut on purpose, not lost (fase 10c). Decorative, so the reader skips it.
 */
export function MoreBelowFade({ visible }: { visible: boolean }) {
  const { colors } = useTheme();
  if (!visible) return null;
  return (
    <LinearGradient
      testID="more-below"
      pointerEvents="none"
      colors={[`${colors.page}00`, colors.page]}
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 32 }}
    />
  );
}
