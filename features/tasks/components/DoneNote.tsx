import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { MemberMark } from '@/domain/members/marks';
import { doneWhen } from '@/domain/tasks/labels';
import type { TaskItem } from '@/domain/tasks/views';
import { isFresh, takeFresh } from '@/features/tasks/freshIds';
import { t } from '@/i18n';
import { Magnet } from '@/ui/components/Magnet';
import { UnsentMark } from '@/ui/components/UnsentMark';
import { enterAnimation, layoutTransition, tiltFor } from '@/ui/motion';
import { useReduceMotion, useTheme } from '@/ui/theme';
import { displayFontBold, magnetSizes, MIN_TOUCH } from '@/ui/tokens';

type Props = {
  task: TaskItem;
  mark: MemberMark | undefined;
  name: string | undefined;
  /** The signed-in user completed it, read out as "hecha por ti". */
  byYou: boolean;
  /** YYYY-MM-DD, to say "ayer" or the date for a task done another day. */
  today: string;
  /** Marked without a connection and still waiting to be sent (bloque 11). */
  unsent: boolean;
  onReopen: (task: TaskItem) => void;
};

/** A finished task as a compact note; its filled magnet hangs on the left edge and tapping reopens it. */
export function DoneNote({ task, mark, name, byYou, today, unsent, onReopen }: Props) {
  const { colors, noteEdge, radii, space } = useTheme();
  const reduceMotion = useReduceMotion();
  // Only a task completed in this session arrives; the rest of the tray is simply there.
  const [fresh] = useState(() => isFresh(task.id, 'done'));
  useEffect(() => {
    takeFresh(task.id, 'done');
  }, [task.id]);
  // When, never who: the magnet already says who did it.
  const when = task.completedAt === null ? null : doneWhen(task.completedAt, today);
  const reopen = byYou
    ? t('tasks.a11y.reopenByYou', { title: task.title })
    : name
      ? t('tasks.a11y.reopenBy', { title: task.title, name })
      : t('tasks.a11y.reopen', { title: task.title });
  const label = [reopen, when, unsent ? t('shopping.pending').toLowerCase() : null]
    .filter((part) => part !== null)
    .join(', ');
  return (
    <Animated.View
      // It arrives from the list on the same spring the note left it with.
      layout={layoutTransition(reduceMotion)}
      entering={fresh ? enterAnimation(reduceMotion, tiltFor(task.id)) : undefined}
      style={{ marginLeft: magnetSizes.sm / 2 }}
    >
      <Pressable
        testID={`done-tray.${task.id}`}
        onPress={() => onReopen(task)}
        accessibilityRole="checkbox"
        aria-checked={true}
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
        {/* The time sits after the title and wraps under it when large text leaves no room. */}
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            columnGap: space(2),
            paddingVertical: space(2),
            paddingLeft: space(2),
            paddingRight: space(3),
          }}
        >
          <Text
            numberOfLines={2}
            style={{
              flexGrow: 1,
              maxWidth: '100%',
              color: colors.mutedStrong,
              fontFamily: displayFontBold,
              fontSize: 16,
            }}
          >
            {task.title}
          </Text>
          {when === null ? null : (
            <Text
              style={{
                marginLeft: 'auto',
                color: colors.muted,
                fontSize: 14,
                fontVariant: ['tabular-nums'],
              }}
            >
              {when}
            </Text>
          )}
          {/* The same mark as a shopping row waiting for the connection; the time it shows is
              the tap's, and it stays when the change arrives. Always in the tree, folded to no
              size when sent: inserting it into a note that is still laying itself out (a tap
              right after a quick add) crashed Fabric's mounting on Android. Folded in height
              too: at no width its words broke letter by letter and stretched the note (seen on
              the .51, bloque 13). */}
          <View
            testID={`done-tray.${task.id}.mark`}
            accessible={false}
            accessibilityElementsHidden={!unsent}
            importantForAccessibility={unsent ? 'auto' : 'no-hide-descendants'}
            style={unsent ? { alignSelf: 'center' } : { width: 0, height: 0, overflow: 'hidden' }}
          >
            <UnsentMark testID={unsent ? `done-tray.${task.id}.pending` : undefined} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}
