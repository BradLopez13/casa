import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { MemberMark } from '@/domain/members/marks';
import type { ShoppingItem } from '@/domain/shopping/list';
import { t } from '@/i18n';
import { Magnet } from '@/ui/components/Magnet';
import { useReduceMotion, useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';

const BOX = 24;
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
  onOpen: () => void;
};

/** One item on the sheet: a round checkbox, the name (opens it) and its quantity. */
export function ShoppingRow({
  item,
  first,
  unsent,
  buyerMark,
  buyerName,
  flash,
  onToggle,
  onOpen,
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
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle();
  };

  return (
    <Animated.View
      layout={reduceMotion ? undefined : LinearTransition}
      entering={FadeIn}
      exiting={FadeOut}
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
        <View
          style={{
            width: BOX,
            height: BOX,
            borderRadius: BOX / 2,
            borderWidth: 2,
            borderColor: bought ? colors.cobalt : colors.outline,
            backgroundColor: bought ? colors.cobalt : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {bought ? <Ionicons name="checkmark" size={16} color={colors.onCobalt} /> : null}
        </View>
      </Pressable>
      <Pressable
        testID={`shopping.item.${item.id}`}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={item.quantity ? `${item.name}, ${item.quantity}` : item.name}
        accessibilityHint={t('shopping.a11y.edit')}
        style={{
          flex: 1,
          minHeight: MIN_TOUCH,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space(3),
          paddingVertical: space(2),
          paddingLeft: space(1),
        }}
      >
        <Text
          maxFontSizeMultiplier={1.3}
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
            maxFontSizeMultiplier={1.3}
            style={{ color: colors.muted, fontSize: 15, fontVariant: ['tabular-nums'] }}
          >
            {item.quantity}
          </Text>
        ) : null}
      </Pressable>
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
            color={buyerMark?.color ?? 'mustard'}
            initial={buyerMark?.initial ?? ''}
            accessibilityLabel={buyerName ?? ''}
            decorative={buyerName === undefined}
          />
        </View>
      ) : null}
    </Animated.View>
  );
}
