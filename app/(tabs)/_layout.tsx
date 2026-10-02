import { Tabs } from 'expo-router';
import { t } from '@/i18n';
import { useTheme } from '@/ui/theme';

// Phase 1 has only Today and Settings; Tasks and Shopping arrive in their own plans.
export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        // Text-only tabs: no icon package, so nothing differs between iOS and Android.
        tabBarIconStyle: { display: 'none' },
        tabBarLabelStyle: { fontSize: 15, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{ title: t('tabs.today'), tabBarButtonTestID: 'tab.today' }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: t('tabs.settings'), tabBarButtonTestID: 'tab.settings' }}
      />
    </Tabs>
  );
}
