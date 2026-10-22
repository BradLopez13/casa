import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { AccessibilityInfo, Pressable, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { canStep, quantityStep, stepQuantity } from '@/domain/shopping/quantity';
import { markHintSeen } from '@/features/hints/hints';
import { t } from '@/i18n';
import { pressedOpacity } from '@/ui/buttonLook';
import { useNotice } from '@/ui/components/Notice';
import { FADE_MS, haptic } from '@/ui/motion';
import { useReduceMotion, useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';

/** The stepper saves this long after the last tap, so a run of taps is one call. */
export const SAVE_AFTER_MS = 700;
/** And closes on its own after this long untouched. */
export const CLOSE_AFTER_MS = 4000;

const PILL_HEIGHT = 30;
// What a pill with no quantity says (DESIGN.md: «—», never a «1» that looks real). A glyph, not
// words: the screen reader hears «sin cantidad».
const NO_QUANTITY = '—';

type Props = {
  itemId: string;
  name: string;
  quantity: string | null;
  /** The sheet keeps one stepper open at a time. */
  open: boolean;
  online: boolean;
  onOpen: () => void;
  onClose: () => void;
  /** A new quantity to save; the screen skips it when it is the one already there. */
  onCommit: (quantity: string | null) => void;
  /** A quantity that cannot go up and down («un poco») opens the item's sheet instead. */
  onEdit: () => void;
  /** Set to a function that saves the taps not yet sent, so marking the row saves them first. */
  flushRef: RefObject<(() => void) | null>;
};

/**
 * The quantity of a pending item, at the end of its row: «2», «1 kg», or a quiet «—» when there
 * is none (counting from it, the stepper starts at 1). A tap turns it into «− n +»; each tap shows at once and the value saves after a pause.
 * With a screen reader it is adjustable: swipe up or down to change it without opening anything.
 */
export function QuantityPill({
  itemId,
  name,
  quantity,
  open,
  online,
  onOpen,
  onClose,
  onCommit,
  onEdit,
  flushRef,
}: Props) {
  const { colors, radii, space } = useTheme();
  const reduceMotion = useReduceMotion();
  const notify = useNotice();
  const [draft, setDraft] = useState<string | null>(quantity);
  const unsaved = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The latest callbacks and draft for the timers and the unmount flush.
  const latest = useRef({ draft, onCommit, onClose });
  useEffect(() => {
    latest.current = { draft, onCommit, onClose };
  });
  // Opening starts from the saved value.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(quantity);
  }

  const steppable = quantityStep(quantity) !== null;
  const shown = open ? draft : quantity;

  const clearTimers = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    saveTimer.current = null;
    closeTimer.current = null;
  };

  const flush = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (!unsaved.current) return;
    unsaved.current = false;
    latest.current.onCommit(latest.current.draft);
  };

  const armClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => latest.current.onClose(), CLOSE_AFTER_MS);
  };

  useEffect(() => {
    flushRef.current = flush;
    return () => {
      flushRef.current = null;
    };
  });

  // Closing (by any route) saves what is left.
  useEffect(() => {
    if (open) {
      armClose();
      return;
    }
    flush();
    clearTimers();
    // Only the open flag drives this.
  }, [open]);

  // A row that leaves the list (marked, deleted, scrolled out) still saves its last taps.
  useEffect(
    () => () => {
      flush();
      clearTimers();
    },

    [],
  );

  const step = (delta: 1 | -1) => {
    // Quick taps can beat the render, so step from the last value set, not from the closure.
    const current = latest.current.draft;
    if (!canStep(current, delta)) return;
    void haptic('light');
    const next = stepQuantity(current, delta);
    setDraft(next);
    latest.current.draft = next;
    unsaved.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, SAVE_AFTER_MS);
    armClose();
  };

  const press = () => {
    if (!steppable) {
      onEdit();
      return;
    }
    if (!online) {
      notify(t('shopping.quantity.offline'));
      return;
    }
    markHintSeen('quantity');
    onOpen();
  };

  // A screen reader changes it in place, one swipe at a time, and hears the new value.
  const adjust = (delta: 1 | -1) => {
    if (!online) {
      notify(t('shopping.quantity.offline'));
      return;
    }
    if (!canStep(quantity, delta)) return;
    markHintSeen('quantity');
    const next = stepQuantity(quantity, delta);
    onCommit(next);
    AccessibilityInfo.announceForAccessibility(next ?? '1');
  };

  const label = t('shopping.quantity.label', {
    name,
    quantity: shown ?? (open ? '1' : t('shopping.quantity.none')),
  });
  const fade = reduceMotion ? undefined : FadeIn.duration(FADE_MS);

  if (open) {
    const button = (delta: 1 | -1) => {
      const enabled = canStep(draft, delta);
      return (
        <Pressable
          testID={`shopping.item.${itemId}.quantity.${delta === 1 ? 'more' : 'less'}`}
          onPress={() => step(delta)}
          disabled={!enabled}
          accessibilityRole="button"
          accessibilityLabel={t(delta === 1 ? 'shopping.quantity.more' : 'shopping.quantity.less')}
          accessibilityState={{ disabled: !enabled }}
          style={({ pressed }) => ({
            width: MIN_TOUCH,
            height: MIN_TOUCH,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressedOpacity(pressed),
          })}
        >
          <Ionicons
            name={delta === 1 ? 'add' : 'remove'}
            size={20}
            color={enabled ? colors.ink : colors.outline}
          />
        </Pressable>
      );
    };
    return (
      <Animated.View
        entering={fade}
        testID={`shopping.item.${itemId}.quantity.stepper`}
        // Like the closed pill, it never takes more than half the row, so the name stays.
        style={{
          flexShrink: 1,
          maxWidth: '50%',
          flexDirection: 'row',
          alignItems: 'center',
          marginLeft: space(2),
          borderRadius: radii.pill,
          borderWidth: 1,
          borderColor: colors.outline,
        }}
      >
        {button(-1)}
        <Text
          accessibilityLiveRegion="polite"
          accessibilityLabel={label}
          numberOfLines={1}
          style={{
            flexShrink: 1,
            minWidth: space(5),
            textAlign: 'center',
            color: colors.ink,
            fontSize: 15,
            fontVariant: ['tabular-nums'],
          }}
        >
          {draft ?? '1'}
        </Text>
        {button(1)}
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={fade} style={{ flexShrink: 1, maxWidth: '50%', marginLeft: space(2) }}>
      <Pressable
        testID={`shopping.item.${itemId}.quantity`}
        onPress={press}
        hitSlop={{ top: (MIN_TOUCH - PILL_HEIGHT) / 2, bottom: (MIN_TOUCH - PILL_HEIGHT) / 2 }}
        accessibilityRole={steppable ? 'adjustable' : 'button'}
        accessibilityLabel={label}
        accessibilityHint={steppable ? undefined : t('shopping.a11y.edit')}
        accessibilityActions={
          steppable ? [{ name: 'increment' }, { name: 'decrement' }] : undefined
        }
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') adjust(1);
          if (event.nativeEvent.actionName === 'decrement') adjust(-1);
        }}
        style={({ pressed }) => ({
          minHeight: PILL_HEIGHT,
          minWidth: MIN_TOUCH,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: space(1),
          paddingHorizontal: space(3),
          borderRadius: radii.pill,
          borderWidth: 1,
          borderColor: quantity === null ? colors.hairline : colors.outline,
          opacity: pressedOpacity(pressed),
        })}
      >
        {/* The scale of the product sheet, before the value: the same piece in the list and in the
            sheet, so «—» reads as «no quantity» and never as a «−» that removes (fase 10a). */}
        <Ionicons
          name="scale-outline"
          size={14}
          color={colors.muted}
          accessible={false}
          importantForAccessibility="no"
        />
        <Text
          numberOfLines={1}
          style={{
            flexShrink: 1,
            color: quantity === null ? colors.muted : colors.ink,
            fontSize: 15,
            fontVariant: ['tabular-nums'],
          }}
        >
          {quantity ?? NO_QUANTITY}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
