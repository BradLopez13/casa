import { View } from 'react-native';
import type { MemberMark } from '@/domain/members/marks';
import type { TaskItem } from '@/domain/tasks/views';
import { DoneNote } from '@/features/tasks/components/DoneNote';
import { useTheme } from '@/ui/theme';

type Props = {
  tasks: TaskItem[];
  marks: Map<string, MemberMark>;
  names: Map<string, string>;
  /** The signed-in user, read out as "hecha por ti". */
  userId: string | null;
  today: string;
  onReopen: (task: TaskItem) => void;
};

/** Finished tasks as a stack of compact notes; tapping one reopens it. */
export function DoneTray({ tasks, marks, names, userId, today, onReopen }: Props) {
  const { space } = useTheme();
  return (
    <View style={{ gap: space(2) }}>
      {tasks.map((task) => (
        <DoneNote
          key={task.id}
          task={task}
          mark={task.completedBy ? marks.get(task.completedBy) : undefined}
          name={task.completedBy ? names.get(task.completedBy) : undefined}
          byYou={task.completedBy !== null && task.completedBy === userId}
          today={today}
          onReopen={onReopen}
        />
      ))}
    </View>
  );
}
