import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useMembership } from '@/features/households/queries';
import { NavigationRail } from '@/features/navigation/NavigationRail';
import { useHouseholdChannel } from '@/features/realtime/useHouseholdChannel';
import { TaskFilterProvider } from '@/features/tasks/filter';
import { t } from '@/i18n';
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

function renderRail(props: BottomTabBarProps) {
  return <NavigationRail {...props} />;
}

// Today, Tasks, Shopping and Settings: a bottom bar, or a side rail from `expanded`.
export default function TabsLayout() {
  const { colors } = useTheme();
  const { rail } = useLayout();
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
          tabBarStyle: { backgroundColor: colors.page, borderTopColor: colors.hairline },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
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
