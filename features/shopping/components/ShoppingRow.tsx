import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { MemberMark } from '@/domain/members/marks';
import type { ProductIcon } from '@/domain/shopping/icons';
import type { ShoppingItem } from '@/domain/shopping/list';
import { t } from '@/i18n';
import { Magnet } from '@/ui/components/Magnet';
import { FADE_MS, haptic } from '@/ui/motion';
import { useReduceMotion, useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';

/** A glyph name of the icon set; `iconFor` only returns names its test finds in the set. */
export type Glyph = ComponentProps<typeof MaterialCommunityIcons>['name'];

const FLASH_IN_MS = 150;
const FLASH_OUT_MS = 450;

type Props = {
  item: ShoppingItem;
  /** The first row of the sheet has no hairline above it. */
  first: boolean;
  /** A change to this row is still on its way to the server. */
  unsent: boolean;
  /** The buyer's magnet; undefined when they are no longer a member. */
  buyerMark: MemberMark | undefined;
  buyerName: string | undefined;
  /** Bumped each time the row should flash (an add that was already on the list). */
  flash: number;
  onToggle: () => void;
  /** Only pending items can be edited, so only theirs is given; a bought name is plain text. */
  onOpen: (() => void) | undefined;
  /** The product's glyph, deduced from its name; decorative, the name carries the meaning. */
  icon: ProductIcon;
};

/**
 * One item on the sheet: a round checkbox, the product icon, the name (opens a pending one) and
 * its quantity.
 */
export function ShoppingRow({
  item,
  first,
  unsent,
  buyerMark,
  buyerName,
  flash,
  onToggle,
  onOpen,
  icon,
}: Props) {
  const { colors, space } = useTheme();
  const reduceMotion = useReduceMotion();
  const bought = item.boughtAt !== null;
  const glow = useSharedValue(0);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  // A fade in and out, so Reduce Motion needs no other version.
  useEffect(() => {
    if (flash === 0) return;
    // Reanimated shared values are mutated through .value by design.
    // eslint-disable-next-line react-hooks/immutability
    glow.value = withSequence(
      withTiming(1, { duration: FLASH_IN_MS }),
      withTiming(0, { duration: FLASH_OUT_MS }),
    );
  }, [flash, glow]);

  const toggle = () => {
    // Into the bag is a thing done; taking it back out is just a press.
    void haptic(bought ? 'light' : 'success');
    onToggle();
  };

  const label = item.quantity ? `${item.name}, ${item.quantity}` : item.name;
  const nameStyle = {
    flex: 1,
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(2),
    paddingLeft: space(1),
  } as const;
  const name = (
    <>
      <MaterialCommunityIcons
        name={icon as Glyph}
        size={22}
        color={colors.muted}
        accessible={false}
        importantForAccessibility="no"
        style={{ marginRight: space(2) }}
      />
      <Text
        style={{
          flex: 1,
          color: bought ? colors.muted : colors.ink,
          fontSize: 17,
          textDecorationLine: bought ? 'line-through' : 'none',
        }}
      >
        {item.name}
      </Text>
      {item.quantity ? (
        <Text
          // Shares the row with the name, so at a large text size it wraps rather than crowd it out.
          style={{
            flexShrink: 1,
            maxWidth: '50%',
            color: colors.muted,
            fontSize: 15,
            fontVariant: ['tabular-nums'],
          }}
        >
          {item.quantity}
        </Text>
      ) : null}
    </>
  );

  return (
    <Animated.View
      // The list moves the rows (itemLayoutAnimation): the row only fades in and out.
      entering={reduceMotion ? undefined : FadeIn.duration(FADE_MS)}
      exiting={reduceMotion ? undefined : FadeOut.duration(FADE_MS)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: MIN_TOUCH + space(2),
        paddingLeft: space(1),
        paddingRight: space(4),
        borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
        borderTopColor: colors.hairline,
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.door }, glowStyle]}
      />
      <Pressable
        testID={`shopping.item.${item.id}.toggle`}
        onPress={toggle}
        accessibilityRole="checkbox"
        accessibilityLabel={t(bought ? 'shopping.a11y.unmark' : 'shopping.a11y.mark', {
          name: item.name,
        })}
        accessibilityState={{ checked: bought }}
        style={{
          width: MIN_TOUCH,
          height: MIN_TOUCH,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Magnet
          size="sm"
          decorative
          variant="empty"
          edge="solid"
          check={bought ? 'filled' : 'faint'}
          color="teal"
          initial=""
          accessibilityLabel={item.name}
        />
      </Pressable>
      {onOpen ? (
        <Pressable
          testID={`shopping.item.${item.id}`}
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={t('shopping.a11y.edit')}
          style={nameStyle}
        >
          {name}
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={label} style={nameStyle}>
          {name}
        </View>
      )}
      {unsent ? (
        <View
          testID={`shopping.item.${item.id}.pending`}
          accessible
          accessibilityLabel={t('shopping.pending')}
          style={{ marginLeft: space(2) }}
        >
          <Ionicons name="cloud-offline-outline" size={18} color={colors.muted} />
        </View>
      ) : null}
      {bought ? (
        <View style={{ marginLeft: space(3) }}>
          <Magnet
            size="sm"
            variant={buyerMark ? 'filled' : 'empty'}
            edge="solid"
            color={buyerMark?.color ?? 'teal'}
            initial={buyerMark?.initial ?? ''}
            accessibilityLabel={buyerName ? t('shopping.a11y.boughtBy', { name: buyerName }) : ''}
            decorative={buyerName === undefined}
          />
        </View>
      ) : null}
    </Animated.View>
  );
}
