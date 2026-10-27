import { Tabs, useGlobalSearchParams, useRouter, useSegments } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import type { ComponentType } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { View, type ColorValue } from 'react-native';
import { useHouseholds, useMembership, useSwitchHousehold } from '@/features/households/queries';
import { useWarmHouseholds } from '@/features/households/useWarmHouseholds';
import { FridgeTabBar } from '@/features/navigation/FridgeTabBar';
import { NavigationRail } from '@/features/navigation/NavigationRail';
import { coveredByModal } from '@/features/navigation/coveredByModal';
import { useHouseholdChannel } from '@/features/realtime/useHouseholdChannel';
import { TaskFilterProvider } from '@/features/tasks/filter';
import { t } from '@/i18n';
import { DoorHouseholdContext, type DoorHousehold } from '@/ui/components/DoorHeader';
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

/**
 * A link that names a household (`casa://tasks?due=…&household=…`, bloque 12) switches to it when
 * the person is in it; any other id is ignored.
 */
function useHouseholdFromLink(activeId: string | undefined) {
  const { household } = useGlobalSearchParams<{ household?: string | string[] }>();
  const households = useHouseholds().data;
  const switchTo = useSwitchHousehold();
  const wanted = typeof household === 'string' ? household : undefined;
  // Each link switches once: the param stays on the route, and choosing another household
  // afterwards must hold.
  const handled = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (wanted === undefined || handled.current === wanted) return;
    if (!households?.some((h) => h.householdId === wanted)) return;
    handled.current = wanted;
    if (wanted !== activeId) void switchTo(wanted);
  }, [wanted, activeId, households, switchTo]);
}

// Today, Tasks, Shopping and Settings: a bottom bar, or a side rail from `expanded`.
export default function TabsLayout() {
  const { rail } = useLayout();
  const { data: membership } = useMembership();
  const households = useHouseholds().data;
  const router = useRouter();
  // Keeps every member's lists in sync while the tabs are mounted: the active household's
  // channel, closed and opened again on a switch (bloque 12).
  useHouseholdChannel(membership?.householdId);
  useHouseholdFromLink(membership?.householdId);
  useWarmHouseholds();
  // With more than one household the doors name the one shown, and the name opens «Tus casas»
  // (decisión 1 (A) del bloque 12). With one, nothing changes.
  const name = membership?.householdName;
  const several = (households?.length ?? 0) > 1;
  const doorHousehold = useMemo<DoorHousehold | null>(
    () =>
      several && name !== undefined ? { name, onPress: () => router.push('/households') } : null,
    [several, name, router],
  );
  // A sheet over the tabs is the whole screen for a screen reader: the tab beneath is hidden.
  const covered = coveredByModal(useSegments());
  return (
    <DoorHouseholdContext.Provider value={doorHousehold}>
      <TaskFilterProvider householdId={membership?.householdId}>
        <View
          style={{ flex: 1 }}
          accessibilityElementsHidden={covered}
          importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}
        >
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
        </View>
      </TaskFilterProvider>
    </DoorHouseholdContext.Provider>
  );
}
