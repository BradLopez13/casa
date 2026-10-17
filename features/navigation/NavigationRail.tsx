import type { BottomTabBarProps } from 'expo-router/tabs';
import { CommonActions } from 'expo-router/react-navigation';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { RAIL_WIDTH } from '@/ui/layout';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';

const ICON_SIZE = 24;

/**
 * The tab bar for wide windows: a column at the left edge, 88 dp plus the left safe-area inset (a
 * notch in landscape). Same screens, icons, names and testIDs as the bottom bar; the selected tab
 * sits in a filled selection pill, so the state shows as shape as well as colour.
 */
export function NavigationRail({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { colors, radii, space } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        width: RAIL_WIDTH + insets.left,
        paddingLeft: insets.left,
        paddingTop: insets.top + space(4),
        paddingBottom: insets.bottom + space(4),
        gap: space(3),
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
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.dispatch({ ...CommonActions.navigate(route), target: state.key });
          }
        };
        return (
          <Pressable
            key={route.key}
            testID={options.tabBarButtonTestID}
            // Same roles as the bottom bar: iOS does not announce "tab" reliably.
            accessibilityRole={Platform.OS === 'ios' ? 'button' : 'tab'}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? title}
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            style={({ pressed }) => ({
              minHeight: MIN_TOUCH + space(4),
              alignItems: 'center',
              justifyContent: 'center',
              gap: space(1),
              paddingVertical: space(1),
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View
              collapsable={false}
              style={{
                width: space(14),
                height: space(8),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/*
               * The pill is its own view, mounted with its radius and colour together when the tab
               * is selected. Toggling the colour of one view from transparent left later
               * selections square on Android.
               */}
              {focused ? (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { borderRadius: radii.pill, backgroundColor: colors.selection },
                  ]}
                />
              ) : null}
              {options.tabBarIcon?.({ focused, color: tint, size: ICON_SIZE })}
            </View>
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={1.6}
              style={{
                color: focused ? colors.ink : colors.muted,
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
