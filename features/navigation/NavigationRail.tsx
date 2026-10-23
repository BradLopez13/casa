import type { BottomTabBarProps } from 'expo-router/tabs';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { TabMagnet, tabHandlers } from '@/features/navigation/FridgeTabBar';
import { RAIL_WIDTH } from '@/ui/layout';
import { pressedOpacity } from '@/ui/buttonLook';
import { useTheme } from '@/ui/theme';
import { useLayout } from '@/ui/useLayout';
import { MIN_TOUCH } from '@/ui/tokens';

const ICON_SIZE = 24;

/**
 * The tab bar for wide windows and for a phone on its side: a column at the left edge, 88 dp plus the left safe-area inset (a
 * notch in landscape). Same screens, icons, names and testIDs as the bottom bar; the selected tab
 * holds its icon on the same selection magnet (`TabMagnet`), so the state shows as shape as well as
 * colour.
 */
export function NavigationRail({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { colors, space } = useTheme();
  const handlers = tabHandlers({ state, navigation });
  // A phone on its side has about 375 dp: the four tabs close up and centre so they fit with
  // enlarged labels.
  const { shortHeight } = useLayout();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        width: RAIL_WIDTH + insets.left,
        paddingLeft: insets.left,
        paddingTop: insets.top + space(shortHeight ? 2 : 4),
        paddingBottom: insets.bottom + space(shortHeight ? 2 : 4),
        gap: space(shortHeight ? 1 : 3),
        justifyContent: shortHeight ? 'center' : 'flex-start',
        backgroundColor: colors.page,
        borderRightWidth: StyleSheet.hairlineWidth,
        borderRightColor: colors.hairline,
      }}
    >
      {state.routes.map((route, index) => {
        const descriptor = descriptors[route.key];
        if (!descriptor) return null;
        const { options } = descriptor;
        const focused = index === state.index;
        const title = options.title ?? route.name;
        const tint = focused ? colors.onSelection : colors.muted;
        return (
          <Pressable
            key={route.key}
            testID={options.tabBarButtonTestID}
            // Same roles as the bottom bar: iOS does not announce "tab" reliably.
            accessibilityRole={Platform.OS === 'ios' ? 'button' : 'tab'}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? title}
            aria-selected={focused}
            {...handlers(route, focused)}
            style={({ pressed }) => ({
              minHeight: MIN_TOUCH + space(4),
              alignItems: 'center',
              justifyContent: 'center',
              gap: space(1),
              paddingVertical: space(1),
              opacity: pressedOpacity(pressed),
            })}
          >
            <TabMagnet
              focused={focused}
              icon={options.tabBarIcon?.({ focused, color: tint, size: ICON_SIZE })}
            />
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={1.6}
              style={{
                color: focused ? colors.cobalt : colors.muted,
                fontSize: 12,
                fontWeight: focused ? '700' : '600',
                textAlign: 'center',
                paddingHorizontal: space(1),
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
