import { LinearGradient } from 'expo-linear-gradient';
import { cloneElement, useEffect, useRef, type ReactElement } from 'react';
import {
  AccessibilityInfo,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMembership } from '@/features/households/queries';
import { useShoppingItems } from '@/features/shopping/queries';
import { t } from '@/i18n';
import { FADE_MS, MAX_MS } from '../motion';
import { useReduceMotion, useTheme } from '../theme';
import { DOOR_OPEN } from '../tokens';
import { DoorInsetContext, FridgeRefreshContext } from './DoorHeader';
import { NidoSymbol } from './NidoSymbol';

export { useFridgeRefresh } from './DoorHeader';

type ScrollableProps = {
  refreshControl?: ReactElement;
  contentContainerStyle?: StyleProp<ViewStyle>;
  contentInsetAdjustmentBehavior?: 'automatic' | 'scrollableAxes' | 'never' | 'always';
};

type Props = {
  refreshing: boolean;
  onRefresh: () => void;
  /** One ScrollView, FlatList or SectionList whose first item is the DoorHeader. */
  children: ReactElement<ScrollableProps>;
};

const SLIDE = { duration: MAX_MS, easing: Easing.out(Easing.exp) };

function useRefreshAnnouncement(refreshing: boolean) {
  const was = useRef(refreshing);
  useEffect(() => {
    // The start and the end: without the end, a screen reader never hears the refresh is over.
    if (refreshing) AccessibilityInfo.announceForAccessibility(t('refresh.label'));
    else if (was.current) AccessibilityInfo.announceForAccessibility(t('refresh.done'));
    was.current = refreshing;
  }, [refreshing]);
}

/**
 * Pull-to-refresh for a pane that scrolls below a fixed door (two panes), where the door is
 * outside the scroll and cannot open: the native spinner in the fridge's colours, with the same
 * announcement. Give it to one pane only, so a refresh shows one spinner.
 */
export function usePaneRefreshControl(
  refreshing: boolean,
  onRefresh: () => void,
): ReactElement<RefreshControlProps> {
  const { colors } = useTheme();
  useRefreshAnnouncement(refreshing);
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={colors.cobalt}
      colors={[colors.cobalt]}
      progressBackgroundColor={colors.note}
    />
  );
}
const FADE = { duration: FADE_MS };

/** What the light shows inside the fridge: how much is left on the shopping list. */
function useInsideLine(): string | null {
  const householdId = useMembership().data?.householdId;
  const items = useShoppingItems(householdId).data;
  if (items === undefined) return null;
  const n = items.filter((item) => item.boughtAt === null).length;
  if (n === 0) return t('refresh.insideNone');
  return n === 1 ? t('refresh.insideOne') : t('refresh.inside', { n });
}

/**
 * Pull-to-refresh that opens the fridge door: the native RefreshControl does the gesture, and
 * while it refreshes the door moves down and the fridge light shows above it.
 *
 * iOS already moves the content down while refreshing, so there the light sits behind the
 * transparent list and shows through that gap. Android's spinner floats over the content, so
 * there the list itself slides down. With Reduce Motion our door never moves: the light fades
 * in over the top of the door instead (the native iOS refresh gap is the system's own).
 */
export function FridgeRefresh({ refreshing, onRefresh, children }: Props) {
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const ios = Platform.OS === 'ios';
  const offset = useSharedValue(0);
  // Only the Reduce Motion band fades; the band behind the door is always lit.
  const glow = useSharedValue(0);
  const inside = useInsideLine();

  useRefreshAnnouncement(refreshing);

  useEffect(() => {
    if (reduceMotion) {
      offset.value = 0;
      glow.value = withTiming(refreshing ? 1 : 0, FADE);
    } else {
      offset.value = withTiming(!ios && refreshing ? DOOR_OPEN : 0, SLIDE);
      glow.value = 0;
    }
  }, [refreshing, reduceMotion, ios, offset, glow]);

  const door = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  const fade = useAnimatedStyle(() => ({ opacity: glow.value }));

  const scrollable = cloneElement(children, {
    refreshControl: (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        // iOS: the light and its label are the indicator. Android keeps its native spinner.
        tintColor={ios ? 'transparent' : colors.cobalt}
        colors={[colors.cobalt]}
        progressBackgroundColor={colors.note}
      />
    ),
    contentInsetAdjustmentBehavior: 'never',
    // On iOS the list is transparent so the light behind it shows when the door opens.
    contentContainerStyle: [
      children.props.contentContainerStyle,
      ios ? { flexGrow: 1, backgroundColor: colors.page } : null,
    ],
  });

  const band = (light: typeof fade | null) => (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      // Under Reduce Motion it lies over the door: it must never take a tap.
      pointerEvents="none"
      style={[
        { position: 'absolute', left: 0, right: 0, top: insets.top, height: DOOR_OPEN },
        light,
      ]}
    >
      <LinearGradient colors={[colors.light.top, colors.page]} style={StyleSheet.absoluteFill} />
      <View
        style={{
          position: 'absolute',
          top: 18,
          left: 26,
          right: 26,
          height: 3,
          borderRadius: 2, // decorativo: no es un control
          backgroundColor: colors.light.shelf,
        }}
      />
      {/* The band has a fixed height, so the label's growth with text size is capped. The band
          only shows while the door is open, so the inside of the fridge is seen only then. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: ios ? 20 : 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space(2),
        }}
      >
        {inside === null ? null : <NidoSymbol size={20} mono={colors.light.text} />}
        <Text
          maxFontSizeMultiplier={1.6}
          numberOfLines={1}
          style={{ color: colors.light.text, fontSize: 13, fontWeight: '600' }}
        >
          {t('refresh.label')}
        </Text>
        {inside === null ? null : (
          <Text
            maxFontSizeMultiplier={1.6}
            numberOfLines={1}
            style={{ flexShrink: 1, color: colors.light.text, fontSize: 13 }}
          >
            {inside}
          </Text>
        )}
      </View>
    </Animated.View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.page, overflow: 'hidden' }}>
      {reduceMotion ? null : band(null)}
      <Animated.View
        style={[
          { flex: 1, marginTop: insets.top, backgroundColor: ios ? 'transparent' : colors.page },
          door,
        ]}
      >
        <FridgeRefreshContext.Provider value={{ refreshing, onRefresh }}>
          <DoorInsetContext.Provider value>{scrollable}</DoorInsetContext.Provider>
        </FridgeRefreshContext.Provider>
      </Animated.View>
      {reduceMotion ? band(fade) : null}
      {/* The status bar keeps the door colour while the door itself moves. */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          backgroundColor: colors.door,
        }}
      />
    </View>
  );
}
