import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { DoorInsetContext } from './DoorHeader';

/**
 * For a tab whose door scrolls without `FridgeRefresh` (Ajustes): the content starts under the
 * status bar and the bar keeps the door's colour, so nothing scrolls under the clock. The door
 * inside then leaves the inset out, as it does in `FridgeRefresh`.
 */
export function StatusBarVeil({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View style={{ flex: 1, marginTop: insets.top }}>
        <DoorInsetContext.Provider value>{children}</DoorInsetContext.Provider>
      </View>
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
