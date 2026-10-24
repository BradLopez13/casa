import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import type { MagnetColor } from '@/domain/members/marks';
import { pressedOpacity } from '../buttonLook';
import { magnetCheckStyle, type MagnetCheck } from '../magnetCheck';
import { magnetDrop } from '../magnetDrop';
import { positEdge } from '../positEdge';
import { useTheme } from '../theme';
import {
  displayFont,
  magnetInitialSizes,
  magnetSizes,
  MIN_TOUCH,
  type MagnetSize,
} from '../tokens';

type Props = {
  initial: string;
  color: MagnetColor;
  size: MagnetSize;
  /** 'empty' is the bare solid ring: an unassigned task, or an unticked box (dashed is paused). */
  variant?: 'filled' | 'empty';
  /** Pass a boolean when the magnet can be selected; true draws the selection ring. */
  selected?: boolean;
  accessibilityLabel: string;
  testID?: string;
  onPress?: () => void;
  /** "radio" when the magnet is one choice in a radiogroup; defaults to a button. */
  accessibilityRole?: 'button' | 'radio';
  /** Hide it from screen readers when the person's name is already read next to it. */
  decorative?: boolean;
  /** A ticked box: the magnet fills with the accent and shows the check. Unticked boxes leave it out. */
  check?: MagnetCheck;
  /** Replaces the initial with a drawing (the Nido symbol of "Todos"), on `fill` instead of a member colour. */
  glyph?: { node: ReactNode; fill: string };
};

const RING = 2;
const GAP = 3;

export function Magnet({
  initial,
  color,
  size,
  variant = 'filled',
  selected,
  accessibilityLabel,
  testID,
  onPress,
  accessibilityRole = 'button',
  decorative = false,
  check,
  glyph,
}: Props) {
  const { colors, shadows } = useTheme();
  const diameter = magnetSizes[size];
  const empty = variant === 'empty';
  // The chip-sized magnet sits inside a pill and stays flat.
  const look = check ? magnetCheckStyle(colors) : null;
  const filledCheck = look !== null;
  const raised = !empty && size !== 'sm';
  const fill = look?.fill ?? glyph?.fill ?? (empty ? 'transparent' : colors.magnet[color]);
  // Two stacked Views: Android allows one elevation per View, so ambient outside, contact inside.
  const depth = raised ? shadows.magnet : null;
  const showHighlight = raised && !glyph;

  const disc = (
    <View
      style={{
        width: diameter,
        height: diameter,
        borderRadius: diameter / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: fill,
        ...(empty && !filledCheck ? { borderWidth: 1.5, borderColor: colors.outline } : {}),
        // Inner 1 dp ring (border-box sizing keeps the outer diameter).
        ...(!empty && !filledCheck && colors.magnetRing !== 'transparent'
          ? { borderWidth: 1, borderColor: colors.magnetRing }
          : {}),
        // A pósit magnet on paper with high contrast: the slate edge, over the ring.
        ...positEdge(fill, colors),
        ...depth,
      }}
    >
      {showHighlight ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 1,
            left: 1,
            right: 1,
            bottom: 1,
            borderRadius: diameter / 2,
            borderTopWidth: 1,
            borderTopColor: colors.magnetHighlight,
          }}
        />
      ) : null}
      {glyph && !empty && !filledCheck ? glyph.node : null}
      {empty || filledCheck || glyph ? null : (
        <Text
          maxFontSizeMultiplier={1.6}
          style={{
            color: colors.magnetInk,
            fontFamily: displayFont,
            fontSize: magnetInitialSizes[size],
            lineHeight: Math.round(magnetInitialSizes[size] * 1.25),
            textAlign: 'center',
            ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
          }}
        >
          {initial}
        </Text>
      )}
      {look ? (
        <Ionicons
          name="checkmark"
          size={Math.round(diameter * 0.66)}
          color={look.tint}
          accessible={false}
        />
      ) : null}
    </View>
  );

  const drop = magnetDrop(colors, raised);
  const lifted = raised ? (
    <View style={{ borderRadius: diameter / 2, backgroundColor: fill, ...shadows.magnetAmbient }}>
      {/* Dark only: the shadow the slate hides, drawn as a disc just under the magnet. */}
      {drop ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: drop.offset,
            left: 0,
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            backgroundColor: drop.color,
          }}
        />
      ) : null}
      {disc}
    </View>
  ) : (
    disc
  );

  // A selectable magnet always reserves the ring's space, so selecting never shifts the row.
  const selectable = selected !== undefined;
  const ringed = selectable ? (
    <View
      style={{
        padding: GAP,
        borderWidth: RING,
        borderRadius: (diameter + 2 * (GAP + RING)) / 2,
        borderColor: selected ? colors.selection : 'transparent',
        backgroundColor: selected ? colors.door : 'transparent',
      }}
    >
      {lifted}
    </View>
  ) : (
    lifted
  );

  const outer = diameter + (selectable ? 2 * (GAP + RING) : 0);
  const slop = Math.max(0, Math.ceil((MIN_TOUCH - outer) / 2));

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        hitSlop={slop}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        aria-selected={selectable ? selected : undefined}
        aria-checked={selectable && accessibilityRole === 'radio' ? selected : undefined}
        style={({ pressed }) => ({ opacity: pressedOpacity(pressed) })}
      >
        {ringed}
      </Pressable>
    );
  }

  return (
    <View
      testID={testID}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : accessibilityLabel}
      aria-selected={!decorative && selectable ? selected : undefined}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
    >
      {ringed}
    </View>
  );
}
