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

/** Anything that can say where it is on screen: a field, or the block around it. */
export type Measurable = {
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
};

/** Brings the focused field into view; pass a block around it to bring that whole block. */
export type Reveal = (block?: Measurable | null) => void;

/**
 * Keeps the focused field of a form in view while the keyboard is up, also on a phone on its side
 * where little height is left: when the keyboard shows, when the visible area shrinks, and when a
 * field takes focus, the scroll view moves just enough to show the whole field. Spread `scroll`
 * on the form's ScrollView and pass `reveal` to each field's `onFocus`.
 *
 * A field with things under it that belong to it (Compra's suggestions and error) passes the block
 * around them: while that field keeps the focus, the whole block is what stays in view. The
 * keyboard's top is taken into account, so this also works on a scroll view that nothing shrinks
 * for the keyboard (a pane beside another).
 */
export function useRevealFocusedField() {
  const ref = useRef<ScrollView>(null);
  const offset = useRef(0);
  // The block last passed for a field, kept while that same field has the focus.
  const group = useRef<{ field: unknown; block: Measurable } | null>(null);

  /** Scrolls just enough to show `target`, the keyboard's top taken into account. */
  const bring = useCallback((target: Measurable) => {
    const scroll = ref.current;
    if (scroll === null) return;
    const viewport = scroll.getNativeScrollRef();
    if (viewport === null) return;
    const keyboard = Keyboard.isVisible() ? Keyboard.metrics() : undefined;
    viewport.measureInWindow((_x, viewportTop, _width, viewportHeight) => {
      target.measureInWindow((_fx, fieldTop, _fwidth, fieldHeight) => {
        const to = revealOffset({
          fieldTop,
          fieldHeight,
          viewportTop,
          viewportHeight,
          offset: offset.current,
          margin: space(4),
          keyboardTop: keyboard?.screenY,
        });
        if (to !== null) scroll.scrollTo({ y: to, animated: true });
      });
    });
  }, []);

  /** Brings a block into view with no field focused (a picker that just opened). */
  const show = useCallback(
    (block: Measurable | null) => {
      if (Platform.OS === 'web' || block === null) return;
      requestAnimationFrame(() => bring(block));
    },
    [bring],
  );

  const reveal = useCallback<Reveal>(
    (block) => {
      // The browser already scrolls a focused field into view, and there is no soft keyboard.
      if (Platform.OS === 'web') return;
      if (block) group.current = { field: TextInput.State.currentlyFocusedInput(), block };
      // Measured after the frame, once the keyboard avoidance has laid the form out again.
      requestAnimationFrame(() => {
        const field = TextInput.State.currentlyFocusedInput();
        if (field === null || field === undefined) return;
        const pinned = group.current;
        bring(pinned !== null && pinned.field === field ? pinned.block : field);
      });
    },
    [bring],
  );

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', () => reveal());
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
  return { scroll, reveal, show };
}
