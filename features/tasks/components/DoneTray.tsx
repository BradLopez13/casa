import { Pressable, Text, View } from 'react-native';
import type { MemberMark } from '@/domain/members/marks';
import type { TaskItem } from '@/domain/tasks/views';
import { t } from '@/i18n';
import { Magnet } from '@/ui/components/Magnet';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';

type Props = {
  tasks: TaskItem[];
  marks: Map<string, MemberMark>;
  names: Map<string, string>;
  onReopen: (task: TaskItem) => void;
};

/** Finished tasks as small pills; tapping one reopens it. */
export function DoneTray({ tasks, marks, names, onReopen }: Props) {
  const { colors, radii, space } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
      {tasks.map((task) => {
        const mark = task.completedBy ? marks.get(task.completedBy) : undefined;
        const name = task.completedBy ? names.get(task.completedBy) : undefined;
        return (
          <Pressable
            key={task.id}
            testID={`done-tray.${task.id}`}
            onPress={() => onReopen(task)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: true }}
            accessibilityLabel={t('tasks.a11y.reopen', { title: task.title })}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space(2),
              minHeight: MIN_TOUCH,
              paddingLeft: space(2),
              paddingRight: space(3),
              borderRadius: radii.pill,
              borderWidth: 1,
              borderColor: colors.outline,
            }}
          >
            <Magnet
              size="sm"
              decorative
              variant={mark ? 'filled' : 'empty'}
              color={mark?.color ?? 'mustard'}
              initial={mark?.initial ?? ''}
              accessibilityLabel={name ?? ''}
            />
            <Text
              maxFontSizeMultiplier={1.3}
              style={{ color: colors.muted, fontSize: 14, textDecorationLine: 'line-through' }}
            >
              {task.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
