import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import type { ComponentProps } from 'react';
import { Platform, Text, useWindowDimensions, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMembership } from '@/features/households/queries';
import { NavigationRail } from '@/features/navigation/NavigationRail';
import { useHouseholdChannel } from '@/features/realtime/useHouseholdChannel';
import { TaskFilterProvider } from '@/features/tasks/filter';
import { t } from '@/i18n';
import { TAB_LABEL_LINE, TAB_LABEL_MAX_SCALE, tabBarHeight } from '@/ui/tabBar';
import { useTheme } from '@/ui/theme';
import { useLayout } from '@/ui/useLayout';

type IconName = ComponentProps<typeof Ionicons>['name'];

function tabIcon(active: IconName, inactive: IconName) {
  function TabIcon({
    color,
    size,
    focused,
  }: {
    color: ColorValue;
    size: number;
    focused: boolean;
  }) {
    return <Ionicons name={focused ? active : inactive} color={color} size={size} />;
  }
  return TabIcon;
}

// iOS keeps tab labels at their size and offers the large content viewer instead, so there the
// bar keeps React Navigation's own label (and its "tab, 1 of 4" for VoiceOver) and height.
const LABELS_SCALE = Platform.OS !== 'ios';

/**
 * A tab's label on Android and the web with enlarged text: React Navigation's own look, capped at the rail's 1.6 and on a fixed line, so the
 * bar's height (`tabBarHeight`) knows how tall it gets.
 */
function TabLabel({
  color,
  position,
  children,
}: {
  color: ColorValue;
  position: 'beside-icon' | 'below-icon';
  children: string;
}) {
  return (
    <Text
      numberOfLines={1}
      maxFontSizeMultiplier={TAB_LABEL_MAX_SCALE}
      style={{
        color,
        fontSize: 12,
        lineHeight: TAB_LABEL_LINE,
        fontWeight: '600',
        textAlign: 'center',
        ...(position === 'beside-icon' ? { marginStart: 5 } : null),
      }}
    >
      {children}
    </Text>
  );
}

function renderRail(props: BottomTabBarProps) {
  return <NavigationRail {...props} />;
}

// Today, Tasks, Shopping and Settings: a bottom bar, or a side rail from `expanded`.
export default function TabsLayout() {
  const { colors } = useTheme();
  const { rail } = useLayout();
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // With enlarged text the bar grows with its labels, still clearing the gesture bar. At the
  // default size (or smaller) the bar and its labels are React Navigation's own, as before.
  const enlarged = LABELS_SCALE && fontScale > 1;
  const barHeight = tabBarHeight({
    width,
    height,
    fontScale: LABELS_SCALE ? fontScale : 1,
    bottomInset: insets.bottom,
  });
  const { data: membership } = useMembership();
  // Keeps every member's lists in sync while the tabs are mounted.
  useHouseholdChannel(membership?.householdId);
  return (
    <TaskFilterProvider>
      <Tabs
        // Without the rail, the default bottom bar exactly as before.
        tabBar={rail ? renderRail : undefined}
        screenOptions={{
          headerShown: false,
          tabBarPosition: rail ? 'left' : 'bottom',
          tabBarActiveTintColor: colors.cobalt,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            backgroundColor: colors.page,
            borderTopColor: colors.hairline,
            ...(barHeight === undefined ? null : { height: barHeight }),
          },
          // The default label's style, kept wherever the custom one is not used.
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
          tabBarLabel: enlarged ? TabLabel : undefined,
        }}
      >
        <Tabs.Screen
          name="today"
          options={{
            title: t('tabs.today'),
            tabBarButtonTestID: 'tab.today',
            tabBarIcon: tabIcon('sunny', 'sunny-outline'),
          }}
        />
        <Tabs.Screen
          name="tasks"
          options={{
            title: t('tabs.tasks'),
            tabBarButtonTestID: 'tab.tasks',
            tabBarIcon: tabIcon('list', 'list-outline'),
          }}
        />
        <Tabs.Screen
          name="shopping"
          options={{
            title: t('tabs.shopping'),
            tabBarButtonTestID: 'tab.shopping',
            tabBarIcon: tabIcon('basket', 'basket-outline'),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('tabs.settings'),
            tabBarButtonTestID: 'tab.settings',
            tabBarIcon: tabIcon('settings', 'settings-outline'),
          }}
        />
      </Tabs>
    </TaskFilterProvider>
  );
}
