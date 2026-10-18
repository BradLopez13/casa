import { useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';
import { brandSignatureSizes } from '../nidoLettering';
import { useTheme } from '../theme';
import { useLayout } from '../useLayout';
import { NidoLettering } from './NidoLettering';
import { NidoSymbol } from './NidoSymbol';

/**
 * The slate band that opens sign-in, sign-up, forgot-password and onboarding: full width, under the status bar,
 * with the signature (symbol, then the «nido» lettering) at the start. `hero` is the larger
 * signature that opens onboarding. Render it as `CenteredCard`'s `header`, which lets it bleed to
 * the edges of the window.
 */
export function BrandHeader({ variant = 'regular' }: { variant?: 'regular' | 'hero' }) {
  const { colors, space } = useTheme();
  const { gutter, shortHeight } = useLayout();
  const insets = useSafeAreaInsets();
  // Only while this screen is in front: it must not tint the status bar of a screen pushed on top.
  const focused = useIsFocused();
  const sizes = brandSignatureSizes(variant, shortHeight);
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
      {focused ? <StatusBar style="light" /> : null}
      {/* One image named «Nido»: the screen reader reads the name the lettering draws. */}
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('brand.name')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: sizes.gap }}
      >
        <NidoSymbol size={sizes.symbol} onSlate />
        <NidoLettering height={sizes.lettering} color={colors.onBrandBand} />
      </View>
    </View>
  );
}
