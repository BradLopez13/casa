import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { MemberMark } from '@/domain/members/marks';
import type { TaskItem } from '@/domain/tasks/views';
import { t } from '@/i18n';
import { Magnet } from '@/ui/components/Magnet';
import { enterAnimation, layoutTransition, tiltFor } from '@/ui/motion';
import { useReduceMotion, useTheme } from '@/ui/theme';
import { displayFontBold, magnetSizes, MIN_TOUCH } from '@/ui/tokens';

type Props = {
  task: TaskItem;
  mark: MemberMark | undefined;
  name: string | undefined;
  /** The signed-in user completed it, read out as "hecha por ti". */
  byYou: boolean;
  onReopen: (task: TaskItem) => void;
};

/** A finished task as a compact note; its filled magnet hangs on the left edge and tapping reopens it. */
export function DoneNote({ task, mark, name, byYou, onReopen }: Props) {
  const { colors, noteEdge, radii, space } = useTheme();
  const reduceMotion = useReduceMotion();
  const label = byYou
    ? t('tasks.a11y.reopenByYou', { title: task.title })
    : name
      ? t('tasks.a11y.reopenBy', { title: task.title, name })
      : t('tasks.a11y.reopen', { title: task.title });
  return (
    <Animated.View
      // It arrives from the list on the same spring the note left it with.
      layout={layoutTransition(reduceMotion)}
      entering={enterAnimation(reduceMotion, tiltFor(task.id))}
      style={{ marginLeft: magnetSizes.sm / 2 }}
    >
      <Pressable
        testID={`done-tray.${task.id}`}
        onPress={() => onReopen(task)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: true }}
        accessibilityLabel={label}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: MIN_TOUCH,
          backgroundColor: colors.taskNote,
          borderRadius: radii.note,
          ...noteEdge,
        }}
      >
        <View style={{ marginLeft: -magnetSizes.sm / 2 }}>
          <Magnet
            size="sm"
            decorative
            variant={mark ? 'filled' : 'empty'}
            check="filled"
            color={mark?.color ?? 'teal'}
            initial={mark?.initial ?? ''}
            accessibilityLabel={name ?? ''}
          />
        </View>
        <Text
          numberOfLines={2}
          style={{
            flex: 1,
            color: colors.mutedStrong,
            fontFamily: displayFontBold,
            fontSize: 16,
            paddingVertical: space(2),
            paddingLeft: space(2),
            paddingRight: space(3),
          }}
        >
          {task.title}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
