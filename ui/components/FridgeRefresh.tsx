import { LinearGradient } from 'expo-linear-gradient';
import { cloneElement, useEffect, type ReactElement } from 'react';
import {
  AccessibilityInfo,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';
import { useTheme } from '../theme';
import { DOOR_OPEN } from '../tokens';
import { DoorInsetContext } from './DoorHeader';

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

const SLIDE = { duration: 280, easing: Easing.out(Easing.exp) };
const FADE = { duration: 200 };

/**
 * Pull-to-refresh that opens the fridge door: the native RefreshControl does the gesture, and
 * while it refreshes the door moves down and the fridge light shows above it.
 *
 * iOS already moves the content down while refreshing, so there the light sits behind the
 * transparent list and shows through that gap. Android's spinner floats over the content, so
 * there the list itself slides down. With Reduce Motion nothing slides: the light fades in.
 */
export function FridgeRefresh({ refreshing, onRefresh, children }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const ios = Platform.OS === 'ios';
  const offset = useSharedValue(0);
  const glow = useSharedValue(reduceMotion ? 0 : 1);

  useEffect(() => {
    if (refreshing) AccessibilityInfo.announceForAccessibility(t('refresh.label'));
  }, [refreshing]);

  useEffect(() => {
    const slide = !ios && refreshing ? DOOR_OPEN : 0;
    if (reduceMotion) {
      offset.value = slide;
      glow.value = withTiming(refreshing ? 1 : 0, FADE);
    } else {
      offset.value = withTiming(slide, SLIDE);
      glow.value = 1;
    }
  }, [refreshing, reduceMotion, ios, offset, glow]);

  const door = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  const light = useAnimatedStyle(() => ({ opacity: glow.value }));

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.page, overflow: 'hidden' }}>
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
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
            borderRadius: 2,
            backgroundColor: colors.light.shelf,
          }}
        />
        <Text
          maxFontSizeMultiplier={1.6}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: ios ? 20 : 12,
            textAlign: 'center',
            color: colors.light.text,
            fontSize: 13,
            fontWeight: '600',
          }}
        >
          {t('refresh.label')}
        </Text>
      </Animated.View>
      <Animated.View
        style={[
          { flex: 1, marginTop: insets.top, backgroundColor: ios ? 'transparent' : colors.page },
          door,
        ]}
      >
        <DoorInsetContext.Provider value>{scrollable}</DoorInsetContext.Provider>
      </Animated.View>
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
