import { useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';
import { BESIDE_SIGNATURE, brandSignatureSizes } from '../nidoLettering';
import { useTheme } from '../theme';
import { authBeside, RAIL_WIDTH } from '../layout';
import { useLayout } from '../useLayout';
import { NidoLettering } from './NidoLettering';
import { NidoSymbol } from './NidoSymbol';

/**
 * The slate band that opens sign-in, sign-up, forgot-password and onboarding: full width, under the status bar,
 * with the signature (symbol, then the «nido» lettering) at the start; on a phone on its side, a
 * column at the left edge (`authBeside`) with the signature stacked. `hero` is the larger
 * signature that opens onboarding. Render it as `CenteredCard`'s `header`, which lets it bleed to
 * the edges of the window. `trailing` is a quiet control at the end of the band (the account
 * menu): at its right, or at the foot of the column.
 */
export function BrandHeader({
  trailing,
  variant = 'regular',
}: { trailing?: ReactNode; variant?: 'regular' | 'hero' } = {}) {
  const { colors, space } = useTheme();
  const layout = useLayout();
  const { gutter, shortHeight } = layout;
  const insets = useSafeAreaInsets();
  // Only while this screen is in front: it must not tint the status bar of a screen pushed on top.
  const focused = useIsFocused();
  // On a phone on its side the band stands at the left, as wide as the rail, all the way down.
  const beside = authBeside(layout);
  const sizes = beside ? BESIDE_SIGNATURE : brandSignatureSizes(variant, shortHeight);
  return (
    <View
      style={
        beside
          ? {
              backgroundColor: colors.brandBand,
              width: RAIL_WIDTH + insets.left,
              paddingTop: insets.top + space(3),
              paddingBottom: insets.bottom + space(3),
              paddingLeft: insets.left,
              alignItems: 'center',
              justifyContent: 'space-between',
            }
          : {
              backgroundColor: colors.brandBand,
              paddingTop: insets.top + (shortHeight ? space(3) : space(5)),
              paddingBottom: shortHeight ? space(3) : space(5),
              paddingLeft: gutter + insets.left,
              paddingRight: gutter + insets.right,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }
      }
    >
      {/* The band is slate in both themes: light status icons while it is on screen. */}
      {focused ? <StatusBar style="light" /> : null}
      {/* One image named «Nido»: the screen reader reads the name the lettering draws. */}
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('brand.name')}
        style={{
          flexDirection: beside ? 'column' : 'row',
          alignItems: 'center',
          gap: sizes.gap,
        }}
      >
        <NidoSymbol size={sizes.symbol} onSlate />
        <NidoLettering height={sizes.lettering} color={colors.onBrandBand} />
      </View>
      {trailing}
    </View>
  );
}
