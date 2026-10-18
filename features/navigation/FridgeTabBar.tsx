import type { BottomTabBarProps } from 'expo-router/tabs';
import { CommonActions } from 'expo-router/react-navigation';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { pressedOpacity } from '@/ui/buttonLook';
import { Magnet } from '@/ui/components/Magnet';
import {
  TAB_BAR_PAD,
  TAB_LABEL_GAP,
  TAB_LABEL_LINE,
  TAB_LABEL_MAX_SCALE,
  TAB_MAGNET,
  tabBarHeight,
  tabLabelsBeside,
} from '@/ui/tabBar';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';

const ICON_SIZE = 24;

type Route = BottomTabBarProps['state']['routes'][number];

/**
 * A tab's icon in its 40 dp slot: on the pósit magnet when the tab is the active one (the icon in
 * `onAccent`), bare otherwise. The slot keeps its size either way, so choosing a tab never moves
 * the row. Shared by the bottom bar and the rail.
 */
export function TabMagnet({ focused, icon }: { focused: boolean; icon: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      collapsable={false}
      style={{
        width: TAB_MAGNET,
        height: TAB_MAGNET,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {focused ? (
        <Magnet
          initial=""
          color="teal"
          size="tab"
          decorative
          accessibilityLabel=""
          glyph={{ node: icon, fill: colors.accent }}
        />
      ) : (
        icon
      )}
    </View>
  );
}

/**
 * What a tab does when pressed or long-pressed, per React Navigation's custom tab bar contract:
 * `tabPress` first (a screen may prevent it), then navigate unless already there.
 */
export function tabHandlers({
  state,
  navigation,
}: Pick<BottomTabBarProps, 'state' | 'navigation'>) {
  return (route: Route, focused: boolean) => ({
    onPress: () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) {
        navigation.dispatch({ ...CommonActions.navigate(route), target: state.key });
      }
    },
    onLongPress: () => navigation.emit({ type: 'tabLongPress', target: route.key }),
  });
}

/**
 * The bottom tab bar as the door's bottom edge: a slate band in both themes, with a chalk hairline
 * along its top. The active tab holds its icon on the pósit magnet; the others are chalk at 80 %.
 * The band runs under the gesture bar (Android edge to edge) and pads its content clear of it.
 */
export function FridgeTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { colors } = useTheme();
  const { width, height, fontScale } = useWindowDimensions();
  const beside = tabLabelsBeside(width, height);
  const barHeight = tabBarHeight({ width, height, fontScale, bottomInset: insets.bottom });
  const handlers = tabHandlers({ state, navigation });
  return (
    <View
      accessibilityRole="tablist"
      style={{
        height: barHeight,
        flexDirection: 'row',
        paddingTop: TAB_BAR_PAD,
        paddingBottom: insets.bottom + TAB_BAR_PAD,
        paddingLeft: insets.left,
        paddingRight: insets.right,
        backgroundColor: colors.tabBar,
      }}
    >
      {/* Drawn over the band rather than as a border, so it takes nothing from the 64 dp row. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.tabBarEdge,
        }}
      />
      {state.routes.map((route, index) => {
        const descriptor = descriptors[route.key];
        if (!descriptor) return null;
        const { options } = descriptor;
        const focused = index === state.index;
        const title = options.title ?? route.name;
        const tint = focused ? colors.onAccent : colors.onTabBarMuted;
        return (
          <Pressable
            key={route.key}
            testID={options.tabBarButtonTestID}
            // Same roles as the rail: iOS does not announce "tab" reliably.
            accessibilityRole={Platform.OS === 'ios' ? 'button' : 'tab'}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? title}
            accessibilityState={{ selected: focused }}
            {...handlers(route, focused)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: MIN_TOUCH,
              flexDirection: beside ? 'row' : 'column',
              alignItems: 'center',
              justifyContent: beside ? 'center' : 'flex-start',
              gap: beside ? TAB_LABEL_GAP : 0,
              opacity: pressedOpacity(pressed),
            })}
          >
            <TabMagnet
              focused={focused}
              icon={options.tabBarIcon?.({ focused, color: tint, size: ICON_SIZE })}
            />
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={TAB_LABEL_MAX_SCALE}
              style={{
                color: focused ? colors.onTabBar : colors.onTabBarMuted,
                fontSize: 12,
                lineHeight: TAB_LABEL_LINE,
                fontWeight: focused ? '700' : '600',
                textAlign: 'center',
              }}
            >
              {title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
