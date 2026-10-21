import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { SPRING } from '../motion';
import { dragOffset, shouldDismiss } from '../sheetDrag';
import { useReduceMotion, useTheme } from '../theme';
import { radii } from '../tokens';

type Drag = { offset: SharedValue<number>; height: SharedValue<number> };

const SheetDragContext = createContext<Drag | null>(null);

/**
 * The frame of a sheet that its header can drag down. Every modal route draws one (`ModalSheet`);
 * a screen outside it (Miembros) has no drag, and its header no handle.
 */
export function SheetDragFrame({ style, children }: { style: object; children: ReactNode }) {
  const offset = useSharedValue(0);
  const height = useSharedValue(0);
  const drag = useMemo(() => ({ offset, height }), [offset, height]);
  const moved = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));
  return (
    <Animated.View
      style={[style, moved]}
      onLayout={(e) => {
        height.set(e.nativeEvent.layout.height);
      }}
    >
      <SheetDragContext.Provider value={drag}>{children}</SheetDragContext.Provider>
    </Animated.View>
  );
}

/**
 * The header of a sheet, as a handle: pulled down past a quarter of the sheet (or flicked), it
 * does what «Cancelar» does, discard guard included; otherwise, or when the guard asks, the sheet
 * springs back. With reduce motion the sheet does not follow the finger. Outside a sheet it is
 * just its children.
 */
export function SheetDragArea({
  onDismiss,
  enabled = true,
  children,
}: {
  onDismiss: () => void;
  enabled?: boolean;
  children: ReactNode;
}) {
  const drag = useContext(SheetDragContext);
  const reduceMotion = useReduceMotion();
  const { colors, space } = useTheme();
  const gesture = useMemo(() => {
    if (drag === null || !enabled) return null;
    const { offset, height } = drag;
    return (
      Gesture.Pan()
        // Down only, and a sideways or upward move is left to whatever is underneath.
        .activeOffsetY(12)
        .failOffsetY(-12)
        .failOffsetX([-24, 24])
        .onUpdate((e) => {
          offset.set(dragOffset(e.translationY, reduceMotion));
        })
        .onEnd((e) => {
          const close = shouldDismiss({
            translationY: e.translationY,
            velocityY: e.velocityY,
            height: height.get(),
          });
          offset.set(reduceMotion ? 0 : withSpring(0, SPRING));
          if (close) runOnJS(onDismiss)();
        })
    );
  }, [drag, enabled, reduceMotion, onDismiss]);
  if (gesture === null) return children;
  return (
    <GestureDetector gesture={gesture}>
      <View>
        {/* The grip says the header can be pulled; «Cancelar» stays the way that needs no gesture. */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            alignSelf: 'center',
            width: 36,
            height: 4,
            marginTop: space(2),
            borderRadius: radii.pill,
            backgroundColor: colors.outline,
          }}
        />
        {children}
      </View>
    </GestureDetector>
  );
}
