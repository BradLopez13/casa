import { useCallback, useEffect, useRef } from 'react';
import {
  Keyboard,
  Platform,
  TextInput,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native';
import { revealOffset } from './reveal';
import { space } from './theme';

/**
 * Keeps the focused field of a form in view while the keyboard is up, also on a phone on its side
 * where little height is left: when the keyboard shows, when the visible area shrinks, and when a
 * field takes focus, the scroll view moves just enough to show the whole field. Spread `scroll`
 * on the form's ScrollView and pass `reveal` to each field's `onFocus`.
 */
export function useRevealFocusedField() {
  const ref = useRef<ScrollView>(null);
  const offset = useRef(0);

  const reveal = useCallback(() => {
    // The browser already scrolls a focused field into view, and there is no soft keyboard.
    if (Platform.OS === 'web') return;
    // Measured after the frame, once the keyboard avoidance has laid the form out again.
    requestAnimationFrame(() => {
      const scroll = ref.current;
      const field = TextInput.State.currentlyFocusedInput();
      if (scroll === null || field === null || field === undefined) return;
      const viewport = scroll.getNativeScrollRef();
      if (viewport === null) return;
      viewport.measureInWindow((_x, viewportTop, _width, viewportHeight) => {
        field.measureInWindow((_fx, fieldTop, _fwidth, fieldHeight) => {
          const to = revealOffset({
            fieldTop,
            fieldHeight,
            viewportTop,
            viewportHeight,
            offset: offset.current,
            margin: space(4),
          });
          if (to !== null) scroll.scrollTo({ y: to, animated: true });
        });
      });
    });
  }, []);

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', reveal);
    return () => subscription.remove();
  }, [reveal]);

  const scroll = {
    ref,
    scrollEventThrottle: 16,
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      offset.current = event.nativeEvent.contentOffset.y;
    },
    onLayout: (_event: LayoutChangeEvent) => reveal(),
  };
  return { scroll, reveal };
}
