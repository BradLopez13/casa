import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useRef, type ComponentProps } from 'react';
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
import { UnsentMark } from '@/ui/components/UnsentMark';
import { FADE_MS, haptic } from '@/ui/motion';
import { useReduceMotion, useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';
import { boughtRowLabel } from '../rowLabels';
import { QuantityPill } from './QuantityPill';

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
  /** The current user bought it: the screen reader says «por ti», not «por Tú». */
  boughtByMe: boolean;
  /** Bumped each time the row should flash (an add that was already on the list). */
  flash: number;
  onToggle: () => void;
  /** Only pending items can be edited, so only theirs is given; a bought name is plain text. */
  onOpen: (() => void) | undefined;
  /** The product's glyph, deduced from its name; decorative, the name carries the meaning. */
  icon: ProductIcon;
  /** This row's quantity stepper is the open one. */
  quantityOpen: boolean;
  onQuantityOpen: () => void;
  onQuantityClose: () => void;
  onQuantity: (quantity: string | null) => void;
};

/**
 * One item on the sheet: on the ruled note, a line with its round checkbox at the left margin, the
 * product icon, the name (opens a pending one) and its quantity written at the right margin, which
 * steps; on a bought one, plain text.
 */
export function ShoppingRow({
  item,
  first,
  unsent,
  buyerMark,
  buyerName,
  boughtByMe,
  flash,
  onToggle,
  onOpen,
  icon,
  quantityOpen,
  onQuantityOpen,
  onQuantityClose,
  onQuantity,
}: Props) {
  const { colors, space } = useTheme();
  const reduceMotion = useReduceMotion();
  const bought = item.boughtAt !== null;
  const glow = useSharedValue(0);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const flushQuantity = useRef<(() => void) | null>(null);

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
    // Taps on the stepper not yet sent go first, while the item is still pending.
    flushQuantity.current?.();
    if (quantityOpen) onQuantityClose();
    onToggle();
  };

  // The quantity has its own stop, so the name says only the name, and whether it waits.
  const label = unsent ? `${item.name}, ${t('shopping.pending').toLowerCase()}` : item.name;
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
      {/* «Sin enviar» goes under the name, in words (bloque 13): beside the quantity it had no
          room at a large text size. */}
      <View style={{ flex: 1, gap: space(0.5) }}>
        <Text
          style={{
            color: bought ? colors.muted : colors.ink,
            fontSize: 17,
            textDecorationLine: bought ? 'line-through' : 'none',
          }}
        >
          {item.name}
        </Text>
        {unsent ? <UnsentMark testID={`shopping.item.${item.id}.pending`} /> : null}
      </View>
      {bought && item.quantity ? (
        // The scale before the value, as on the list and the product sheet (bloque 13).
        <View
          testID={`shopping.item.${item.id}.bought-quantity`}
          style={{
            flexShrink: 1,
            maxWidth: '50%',
            flexDirection: 'row',
            alignItems: 'center',
            gap: space(1),
          }}
        >
          <Ionicons
            name="scale-outline"
            size={14}
            color={colors.muted}
            accessible={false}
            importantForAccessibility="no"
          />
          <Text
            // Shares the row with the name, so at a large text size it wraps rather than crowd it.
            style={{
              flexShrink: 1,
              color: colors.muted,
              fontSize: 15,
              fontVariant: ['tabular-nums'],
            }}
          >
            {item.quantity}
          </Text>
        </View>
      ) : null}
    </>
  );

  // A bought row is one stop for a screen reader: what, how much and who, and a tap puts it back.
  const boughtA11y = bought
    ? ({
        accessible: true,
        accessibilityRole: 'checkbox',
        'aria-checked': true,
        accessibilityLabel: boughtRowLabel({
          name: item.name,
          quantity: item.quantity,
          buyer: buyerName,
          byMe: boughtByMe,
        }),
        accessibilityHint: t('shopping.a11y.unmark', { name: item.name }),
        accessibilityActions: [{ name: 'activate' }],
        onAccessibilityAction: toggle,
      } as const)
    : null;

  return (
    <Animated.View
      // The list moves the rows (itemLayoutAnimation): the row only fades in and out.
      entering={reduceMotion ? undefined : FadeIn.duration(FADE_MS)}
      exiting={reduceMotion ? undefined : FadeOut.duration(FADE_MS)}
      {...boughtA11y}
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
        aria-checked={bought}
        // A bought row speaks as a whole (boughtA11y): its parts stay out of the reader's way.
        accessible={!bought}
        importantForAccessibility={bought ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={bought}
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
          check={bought ? 'filled' : undefined}
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
        <View
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={nameStyle}
        >
          {name}
        </View>
      )}
      {onOpen ? (
        <QuantityPill
          itemId={item.id}
          name={item.name}
          quantity={item.quantity}
          open={quantityOpen}
          onOpen={onQuantityOpen}
          onClose={onQuantityClose}
          onCommit={onQuantity}
          onEdit={onOpen}
          flushRef={flushQuantity}
        />
      ) : null}
      {bought ? (
        <View style={{ marginLeft: space(3) }}>
          <Magnet
            size="sm"
            variant={buyerMark ? 'filled' : 'empty'}
            color={buyerMark?.color ?? 'teal'}
            initial={buyerMark?.initial ?? ''}
            accessibilityLabel=""
            decorative
          />
        </View>
      ) : null}
    </Animated.View>
  );
}
