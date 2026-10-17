import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import ReanimatedSwipeable, {
  SwipeDirection,
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
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
import { isProvisional } from '@/domain/tasks/optimistic';
import type { TaskItem } from '@/domain/tasks/views';
import { noteText } from '@/features/tasks/noteText';
import { t } from '@/i18n';
import { Magnet } from '@/ui/components/Magnet';
import { useReduceMotion, useTheme } from '@/ui/theme';
import { displayFontBold, magnetSizes, MIN_TOUCH } from '@/ui/tokens';

// A note that is still being saved is drawn faded until the server confirms it.
const PROVISIONAL_OPACITY = 0.6;
// With Reduce Motion the strip snaps instead of animating.
const NO_ANIMATION = { duration: 0 };
const PRESS_MS = 80;
const PRESS_SCALE = 0.9;
const TOGGLE_SLOP = Math.ceil((MIN_TOUCH - magnetSizes.md) / 2);

type Props = {
  task: TaskItem;
  today: string;
  mark: MemberMark | undefined;
  assigneeName: string | undefined;
  busy: boolean;
  onToggle: () => void;
  /** Swipe right to complete; the caller offers the undo. */
  onComplete?: () => void;
  onOpen: () => void;
};

/** A task as a paper note; its magnet (the assignee) sticks out of the left edge and completes it. */
export function TaskNote({
  task,
  today,
  mark,
  assigneeName,
  busy,
  onToggle,
  onComplete,
  onOpen,
}: Props) {
  const { colors, shadows, noteEdge, radii, space } = useTheme();
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);
  const magnetStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const done = task.completedAt !== null;
  const provisional = isProvisional(task);
  const { room, due, overdue, repeat, label } = noteText(task, today, assigneeName);

  const swipeable = useRef<SwipeableMethods>(null);
  const canSwipe = !done && !provisional && !busy && !!onComplete;

  const press = () => {
    if (!reduceMotion) {
      // Reanimated shared values are mutated through .value by design.
      // eslint-disable-next-line react-hooks/immutability
      scale.value = withSequence(
        withTiming(PRESS_SCALE, { duration: PRESS_MS }),
        withTiming(1, { duration: PRESS_MS }),
      );
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle();
  };

  return (
    <Animated.View
      layout={reduceMotion ? undefined : LinearTransition}
      entering={reduceMotion ? undefined : FadeIn}
      exiting={reduceMotion ? undefined : FadeOut}
      style={{
        marginLeft: magnetSizes.md / 2,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.taskNote,
        opacity: provisional ? PROVISIONAL_OPACITY : 1,
        borderRadius: radii.note,
        ...shadows.note,
        ...noteEdge,
      }}
    >
      <Pressable
        testID={`task-note.${task.id}.toggle`}
        onPress={press}
        disabled={busy}
        hitSlop={TOGGLE_SLOP}
        accessibilityRole="checkbox"
        accessibilityLabel={t(done ? 'tasks.a11y.reopen' : 'tasks.a11y.complete', {
          title: task.title,
        })}
        accessibilityState={{ checked: done, disabled: busy, busy }}
        style={{ marginLeft: -magnetSizes.md / 2 }}
      >
        <Animated.View style={magnetStyle}>
          <Magnet
            size="md"
            decorative
            variant={mark ? 'filled' : 'empty'}
            posit={!done}
            check={done ? 'filled' : 'faint'}
            color={mark?.color ?? 'teal'}
            initial={mark?.initial ?? ''}
            accessibilityLabel={assigneeName ?? ''}
          />
        </Animated.View>
      </Pressable>
      <ReanimatedSwipeable
        ref={swipeable}
        enabled={canSwipe}
        friction={2}
        leftThreshold={56}
        overshootLeft={false}
        overshootRight={false}
        animationOptions={reduceMotion ? NO_ANIMATION : undefined}
        containerStyle={{ flex: 1, borderRadius: radii.note }}
        renderLeftActions={() => (
          <View
            style={{
              width: 72,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.accent,
            }}
          >
            <Ionicons name="checkmark" size={24} color={colors.onAccent} accessible={false} />
          </View>
        )}
        onSwipeableOpen={(direction) => {
          // Dragging the note right opens the strip on its left; dragging left does nothing.
          if (direction !== SwipeDirection.RIGHT) return;
          onComplete?.();
          swipeable.current?.close();
        }}
      >
        <Pressable
          testID={`task-note.${task.id}`}
          onPress={provisional ? undefined : onOpen}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={provisional ? undefined : t('tasks.a11y.edit')}
          accessibilityState={{ disabled: provisional }}
          accessibilityActions={
            canSwipe
              ? [{ name: 'complete', label: t('tasks.a11y.complete', { title: task.title }) }]
              : undefined
          }
          onAccessibilityAction={(e) => {
            if (canSwipe && e.nativeEvent.actionName === 'complete') onComplete?.();
          }}
          style={{
            flex: 1,
            minHeight: MIN_TOUCH,
            justifyContent: 'center',
            gap: space(0.5),
            padding: space(3),
          }}
        >
          <Text style={{ color: colors.ink, fontFamily: displayFontBold, fontSize: 17 }}>
            {task.title}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 14 }}>
            {room ? `${room} · ` : ''}
            {/* Overdue is a state, never an action: the word "Vencida" in red, semibold, with no
                pill or outline around it (in dark mode red and the apricot actions are close). */}
            <Text
              style={{
                color: overdue ? colors.red : colors.muted,
                fontWeight: overdue ? '600' : '400',
                fontVariant: ['tabular-nums'],
              }}
            >
              {due}
            </Text>
            {repeat ? (
              <>
                {' · '}
                <Ionicons name="repeat" size={14} color={colors.muted} accessible={false} />
                {` ${repeat}`}
              </>
            ) : null}
          </Text>
        </Pressable>
      </ReanimatedSwipeable>
    </Animated.View>
  );
}
