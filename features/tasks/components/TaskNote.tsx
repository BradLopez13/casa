import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import ReanimatedSwipeable, {
  SwipeDirection,
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useIsOnline } from '@/data/query/online';
import type { MemberMark } from '@/domain/members/marks';
import { isProvisional } from '@/domain/tasks/optimistic';
import type { TaskItem } from '@/domain/tasks/views';
import { markHintSeen } from '@/features/hints/hints';
import { isFresh, takeFresh } from '@/features/tasks/freshIds';
import { noteText } from '@/features/tasks/noteText';
import { UnsentMark } from '@/ui/components/UnsentMark';
import { t } from '@/i18n';
import { CompleteBox } from '@/ui/components/CompleteBox';
import { Magnet } from '@/ui/components/Magnet';
import {
  enterAnimation,
  exitAnimation,
  haptic,
  layoutTransition,
  SPRING,
  tiltFor,
} from '@/ui/motion';
import { useReduceMotion, useTheme } from '@/ui/theme';
import { displayFontBold, magnetSizes, MIN_TOUCH } from '@/ui/tokens';

// A note that is still being saved is drawn faded until the server confirms it.
const PROVISIONAL_OPACITY = 0.6;
// With Reduce Motion the strip snaps instead of animating.
const NO_ANIMATION = { duration: 0 };
const PRESS_MS = 80;
const PRESS_SCALE = 0.9;
// A new note's magnet starts a little small and snaps onto the door.
const SNAP_SCALE = 0.85;

type Props = {
  task: TaskItem;
  today: string;
  mark: MemberMark | undefined;
  assigneeName: string | undefined;
  /** The task is the viewer's, so the reader says «tuya». */
  mine?: boolean;
  busy: boolean;
  /** A change to it waits in the queue (created, reopened offline): it says «Sin enviar». */
  unsent?: boolean;
  onToggle: () => void;
  /** Swipe right to complete; the caller offers the undo. */
  onComplete?: () => void;
  onOpen: () => void;
};

/**
 * A task as a paper note: its magnet (the assignee) sticks out of the left edge and the box at the
 * right edge completes it.
 */
export function TaskNote({
  task,
  today,
  mark,
  assigneeName,
  mine = false,
  busy,
  unsent = false,
  onToggle,
  onComplete,
  onOpen,
}: Props) {
  const { colors, shadows, noteEdge, radii, space } = useTheme();
  const reduceMotion = useReduceMotion();
  // Offline the toggle only says so (useToggleTask): the box neither sinks nor buzzes.
  const online = useIsOnline();
  // Only a note created in this session lands: on first render, a filter change or a recycled
  // row it is simply there. Peeked here, used up after mount (a Strict Mode re-run sees it too).
  const [fresh] = useState(() => isFresh(task.id));
  const lands = fresh && !reduceMotion;
  const scale = useSharedValue(lands ? SNAP_SCALE : 1);
  const magnetStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const boxScale = useSharedValue(1);
  const boxStyle = useAnimatedStyle(() => ({ transform: [{ scale: boxScale.value }] }));

  // The magnet snaps on as the note lands (QuickAdd gives the rigid vibration).
  useEffect(() => {
    takeFresh(task.id);
    // Reanimated shared values are mutated through .value by design.
    // eslint-disable-next-line react-hooks/immutability
    if (lands) scale.value = withSpring(1, SPRING);
    // Only on arrival: later presses animate the box instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A note saved from its form lands again: the magnet snaps on as the change arrives (the mount
  // effect above has already used up a mark made before the note was first drawn).
  useEffect(() => {
    if (reduceMotion || !takeFresh(task.id)) return;
    // eslint-disable-next-line react-hooks/immutability
    scale.value = SNAP_SCALE;
    scale.value = withSpring(1, SPRING);
    void haptic('rigid');
    // Only when the task itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task]);

  const done = task.completedAt !== null;
  const provisional = isProvisional(task);
  const text = noteText(task, today, assigneeName, mine);
  const { room, due, overdue, repeat } = text;
  const label = unsent ? `${text.label}, ${t('shopping.pending').toLowerCase()}` : text.label;

  const swipeable = useRef<SwipeableMethods>(null);
  const canSwipe = !done && !provisional && !busy && !!onComplete;

  const press = () => {
    if (!online) {
      onToggle();
      return;
    }
    if (!reduceMotion) {
      // The box sinks and springs back; the note then lifts off (exitAnimation).
      // eslint-disable-next-line react-hooks/immutability
      boxScale.value = withSequence(
        withTiming(PRESS_SCALE, { duration: PRESS_MS }),
        withSpring(1, SPRING),
      );
    }
    // Tapping an open note's box completes it; a done one only reopens.
    void haptic(done ? 'light' : 'success');
    onToggle();
  };

  // A swipe, or the reader's «complete» action. Offline the toggle only says so: the swipe did
  // not work, so its hint stays.
  const complete = () => {
    if (online) {
      void haptic('success');
      markHintSeen('swipe');
    }
    onComplete?.();
  };

  return (
    <Animated.View
      layout={layoutTransition(reduceMotion)}
      entering={lands ? enterAnimation(reduceMotion, tiltFor(task.id)) : undefined}
      exiting={exitAnimation(reduceMotion)}
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
      {/* The magnet only says whose task it is; the box on the right completes it. The reader
          hears whose it is in the note's own label, right after the title. */}
      <Animated.View style={[{ marginLeft: -magnetSizes.md / 2 }, magnetStyle]}>
        <Magnet
          size="md"
          decorative
          variant={mark ? 'filled' : 'empty'}
          color={mark?.color ?? 'teal'}
          initial={mark?.initial ?? ''}
          accessibilityLabel={assigneeName ?? ''}
        />
      </Animated.View>
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
              backgroundColor: colors.accent, // pósit sin borde: franja que solo asoma al deslizar
            }}
          >
            <Ionicons name="checkmark" size={24} color={colors.onAccent} accessible={false} />
          </View>
        )}
        onSwipeableOpen={(direction) => {
          // Dragging the note right opens the strip on its left; dragging left does nothing.
          if (direction !== SwipeDirection.RIGHT) return;
          complete();
          swipeable.current?.close();
        }}
      >
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable
            testID={`task-note.${task.id}`}
            onPress={provisional ? undefined : onOpen}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityHint={provisional ? undefined : t('tasks.a11y.edit')}
            aria-disabled={provisional}
            accessibilityActions={
              canSwipe
                ? [{ name: 'complete', label: t('tasks.a11y.complete', { title: task.title }) }]
                : undefined
            }
            onAccessibilityAction={(e) => {
              if (canSwipe && e.nativeEvent.actionName === 'complete') complete();
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
            {room ? <Text style={{ color: colors.muted, fontSize: 14 }}>{room}</Text> : null}
            {/* Overdue is a calm state, never an alarm: muted text with a clock, no red. */}
            <Text style={{ color: colors.muted, fontSize: 14, fontVariant: ['tabular-nums'] }}>
              <Ionicons
                name={overdue ? 'time-outline' : 'calendar-outline'}
                size={14}
                color={colors.muted}
                accessible={false}
              />
              {` ${due}`}
            </Text>
            {repeat ? (
              <Text style={{ color: colors.muted, fontSize: 14 }}>
                <Ionicons name="repeat" size={14} color={colors.muted} accessible={false} />
                {` ${repeat}`}
              </Text>
            ) : null}
            {unsent ? <UnsentMark testID={`task-note.${task.id}.pending`} /> : null}
          </Pressable>
          <Pressable
            testID={`task-note.${task.id}.toggle`}
            onPress={press}
            disabled={busy}
            accessibilityRole="checkbox"
            accessibilityLabel={t(done ? 'tasks.a11y.reopen' : 'tasks.a11y.complete', {
              title: task.title,
            })}
            aria-checked={done}
            aria-disabled={busy}
            aria-busy={busy}
            style={{
              minWidth: MIN_TOUCH,
              minHeight: MIN_TOUCH,
              alignSelf: 'stretch',
              alignItems: 'center',
              justifyContent: 'center',
              paddingRight: space(2),
            }}
          >
            <Animated.View style={boxStyle}>
              <CompleteBox checked={done} />
            </Animated.View>
          </Pressable>
        </View>
      </ReanimatedSwipeable>
    </Animated.View>
  );
}
