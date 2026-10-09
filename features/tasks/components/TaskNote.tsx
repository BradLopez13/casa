import * as Haptics from 'expo-haptics';
import { Pressable, Text } from 'react-native';
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
import { dueLabel, overdueLabel } from '@/domain/tasks/labels';
import { isOverdue, type TaskItem } from '@/domain/tasks/views';
import { t } from '@/i18n';
import { Magnet } from '@/ui/components/Magnet';
import { useReduceMotion, useTheme } from '@/ui/theme';
import { magnetSizes, MIN_TOUCH } from '@/ui/tokens';

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
  onOpen: () => void;
};

/** A task as a paper note; its magnet (the assignee) sticks out of the left edge and completes it. */
export function TaskNote({ task, today, mark, assigneeName, busy, onToggle, onOpen }: Props) {
  const { colors, shadows, radii, space } = useTheme();
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);
  const magnetStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const done = task.completedAt !== null;
  const overdue = isOverdue(task, today);
  const room = task.room ? t(`rooms.${task.room}`) : null;
  const due = overdue && task.dueOn ? overdueLabel(task.dueOn, today) : dueLabel(task.dueOn, today);
  // The magnet is hidden from screen readers, so the note itself says who it is for.
  const label = [task.title, assigneeName ?? t('tasks.a11y.unassigned'), room, due]
    .filter((part) => part !== null)
    .join(', ');

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
      entering={FadeIn}
      exiting={FadeOut}
      style={{
        marginLeft: magnetSizes.md / 2,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.note,
        borderRadius: radii.note,
        ...shadows.note,
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
            color={mark?.color ?? 'mustard'}
            initial={mark?.initial ?? ''}
            accessibilityLabel={assigneeName ?? ''}
          />
        </Animated.View>
      </Pressable>
      <Pressable
        testID={`task-note.${task.id}`}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t('tasks.a11y.edit')}
        style={{
          flex: 1,
          minHeight: MIN_TOUCH,
          justifyContent: 'center',
          gap: space(0.5),
          padding: space(3),
        }}
      >
        <Text
          maxFontSizeMultiplier={1.3}
          style={{ color: colors.ink, fontSize: 17, fontWeight: '600' }}
        >
          {task.title}
        </Text>
        <Text maxFontSizeMultiplier={1.3} style={{ color: colors.muted, fontSize: 14 }}>
          {room ? `${room} · ` : ''}
          <Text
            style={{ color: overdue ? colors.red : colors.muted, fontVariant: ['tabular-nums'] }}
          >
            {due}
          </Text>
        </Text>
      </Pressable>
    </Animated.View>
  );
}
