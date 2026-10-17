import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { useLayout } from '../useLayout';
import { NidoSymbol } from './NidoSymbol';

/**
 * The slate band that opens sign-in, sign-up, forgot-password and onboarding: full width, under the status bar,
 * with the symbol at the start. Render it as `CenteredCard`'s `header`, which lets it bleed to the
 * edges of the window.
 */
export function BrandHeader() {
  const { colors, space } = useTheme();
  const { gutter, shortHeight } = useLayout();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: colors.brandBand,
        paddingTop: insets.top + (shortHeight ? space(3) : space(5)),
        paddingBottom: shortHeight ? space(3) : space(5),
        paddingLeft: gutter + insets.left,
        paddingRight: gutter + insets.right,
        alignItems: 'flex-start',
      }}
    >
      {/* The band is slate in both themes: light status icons while it is on screen. */}
      <StatusBar style="light" />
      <NidoSymbol size={shortHeight ? 48 : 64} onSlate />
    </View>
  );
}
