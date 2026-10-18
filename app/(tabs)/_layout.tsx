import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import type { ComponentType } from 'react';
import type { ColorValue } from 'react-native';
import { useMembership } from '@/features/households/queries';
import { FridgeTabBar } from '@/features/navigation/FridgeTabBar';
import { NavigationRail } from '@/features/navigation/NavigationRail';
import { useHouseholdChannel } from '@/features/realtime/useHouseholdChannel';
import { TaskFilterProvider } from '@/features/tasks/filter';
import { t } from '@/i18n';
import { BasketIcon, GearIcon, ListIcon, SunIcon, type TabIconProps } from '@/ui/tabIcons';
import { useLayout } from '@/ui/useLayout';

/** The tab's icon as React Navigation asks for it; each bar puts it on the pósit when active. */
function tabIcon(Icon: ComponentType<TabIconProps>) {
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Icon color={color} size={size} />;
  }
  return TabIcon;
}

function renderRail(props: BottomTabBarProps) {
  return <NavigationRail {...props} />;
}

function renderFridgeTabBar(props: BottomTabBarProps) {
  return <FridgeTabBar {...props} />;
}

// Today, Tasks, Shopping and Settings: a bottom bar, or a side rail from `expanded`.
export default function TabsLayout() {
  const { rail } = useLayout();
  const { data: membership } = useMembership();
  // Keeps every member's lists in sync while the tabs are mounted.
  useHouseholdChannel(membership?.householdId);
  return (
    <TaskFilterProvider>
      <Tabs
        // The fridge's slate bottom edge on phones; the side rail on wide windows.
        tabBar={rail ? renderRail : renderFridgeTabBar}
        screenOptions={{
          headerShown: false,
          tabBarPosition: rail ? 'left' : 'bottom',
        }}
      >
        <Tabs.Screen
          name="today"
          options={{
            title: t('tabs.today'),
            tabBarAccessibilityLabel: t('tabs.today'),
            tabBarButtonTestID: 'tab.today',
            tabBarIcon: tabIcon(SunIcon),
          }}
        />
        <Tabs.Screen
          name="tasks"
          options={{
            title: t('tabs.tasks'),
            tabBarAccessibilityLabel: t('tabs.tasks'),
            tabBarButtonTestID: 'tab.tasks',
            tabBarIcon: tabIcon(ListIcon),
          }}
        />
        <Tabs.Screen
          name="shopping"
          options={{
            title: t('tabs.shopping'),
            tabBarAccessibilityLabel: t('tabs.shopping'),
            tabBarButtonTestID: 'tab.shopping',
            tabBarIcon: tabIcon(BasketIcon),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('tabs.settings'),
            tabBarAccessibilityLabel: t('tabs.settings'),
            tabBarButtonTestID: 'tab.settings',
            tabBarIcon: tabIcon(GearIcon),
          }}
        />
      </Tabs>
    </TaskFilterProvider>
  );
}
