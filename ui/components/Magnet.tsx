import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import type { MagnetColor } from '@/domain/members/marks';
import { pressedOpacity } from '../buttonLook';
import { magnetCheckStyle, type MagnetCheck } from '../magnetCheck';
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
  /** 'empty' is the dashed circle used for an unassigned task. */
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
  /** Empty magnet only: draw the dashed ring in the pósit, 2 dp, in dark mode (the checkbox of a task note). */
  posit?: boolean;
  /** faint: an open check (corner badge, or centred when empty). filled: the magnet fills with the accent and shows the check. */
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
  posit = false,
  check,
  glyph,
}: Props) {
  const { colors, shadows } = useTheme();
  const diameter = magnetSizes[size];
  const empty = variant === 'empty';
  const { scheme } = useTheme();
  const positRing = empty && posit && scheme === 'dark';
  // The chip-sized magnet sits inside a pill and stays flat.
  const look = check ? magnetCheckStyle(check, colors) : null;
  const filledCheck = look?.fill != null;
  const depth = !empty && size !== 'sm' ? shadows.magnet : null;

  const disc = (
    <View
      style={{
        width: diameter,
        height: diameter,
        borderRadius: diameter / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor:
          look?.fill ?? glyph?.fill ?? (empty ? 'transparent' : colors.magnet[color]),
        ...(empty && !filledCheck
          ? positRing
            ? { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.selection }
            : { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.outline }
          : {}),
        // Inner 1 dp ring (border-box sizing keeps the outer diameter); dark has none.
        ...(!empty && !filledCheck && colors.magnetRing !== 'transparent'
          ? { borderWidth: 1, borderColor: colors.magnetRing }
          : {}),
        ...depth,
      }}
    >
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
      {look && (filledCheck || empty) ? (
        <Ionicons
          name="checkmark"
          size={Math.round(diameter * (filledCheck ? 0.66 : 0.5))}
          color={look.tint}
          style={{ opacity: look.opacity }}
          accessible={false}
        />
      ) : null}
      {look && !filledCheck && !empty ? (
        <View
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: Math.round(diameter * 0.42),
            height: Math.round(diameter * 0.42),
            borderRadius: diameter,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.taskNote,
          }}
        >
          <Ionicons
            name="checkmark"
            size={Math.round(diameter * 0.34)}
            color={look.tint}
            style={{ opacity: look.opacity }}
            accessible={false}
          />
        </View>
      ) : null}
    </View>
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
      {disc}
    </View>
  ) : (
    disc
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
        accessibilityState={
          selectable
            ? { selected, ...(accessibilityRole === 'radio' ? { checked: selected } : null) }
            : undefined
        }
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
      accessibilityState={!decorative && selectable ? { selected } : undefined}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
    >
      {ringed}
    </View>
  );
}
