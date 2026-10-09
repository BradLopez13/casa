import { useRouter } from 'expo-router';
import { View } from 'react-native';
import type { MemberMark } from '@/domain/members/marks';
import type { TaskListRow } from '@/features/tasks/sections';
import type { ToggleVars } from '@/features/tasks/toggle';
import { space } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';
import { DoneTray } from './DoneTray';
import { TaskNote } from './TaskNote';

type Props = {
  row: TaskListRow;
  today: string;
  marks: Map<string, MemberMark>;
  names: Map<string, string>;
  userId: string | null;
  isBusy: (id: string) => boolean;
  toggle: (vars: ToggleVars) => void;
};

/** One list row: an open task as a note (opens its form), or the tray of finished ones. */
export function TaskRow({ row, today, marks, names, userId, isBusy, toggle }: Props) {
  const router = useRouter();
  const openTask = (id: string) => router.push({ pathname: '/task/[id]', params: { id } });
  return (
    <View style={{ paddingHorizontal: space(5) }}>
      {row.kind === 'note' ? (
        <TaskNote
          task={row.task}
          today={today}
          mark={row.task.assigneeId ? marks.get(row.task.assigneeId) : undefined}
          assigneeName={row.task.assigneeId ? names.get(row.task.assigneeId) : undefined}
          busy={isBusy(row.task.id)}
          onToggle={() => toggle({ id: row.task.id, done: true })}
          onOpen={() => openTask(row.task.id)}
        />
      ) : (
        <DoneTray
          tasks={row.tasks}
          marks={marks}
          names={names}
          userId={userId}
          onReopen={(task) => toggle({ id: task.id, done: false })}
        />
      )}
    </View>
  );
}

/** There is at most one tray per list, so it can share a fixed key. */
export const taskRowKey = (row: TaskListRow) => (row.kind === 'note' ? row.task.id : 'done-tray');

export function TaskRowSeparator() {
  return <View style={{ height: space(3) }} />;
}

/** Room under the last note so the floating "Nueva tarea" pill never covers it. */
export const taskListContentStyle = { paddingBottom: MIN_TOUCH + space(12) };
