import { useRouter } from 'expo-router';
import { View } from 'react-native';
import type { MemberMark } from '@/domain/members/marks';
import type { TaskListRow } from '@/features/tasks/sections';
import type { ToggleVars } from '@/features/tasks/toggle';
import { useCompleteHint } from '@/features/tasks/completeHint';
import { completeWithUndo } from '@/features/tasks/undo';
import { useNotice } from '@/ui/components/Notice';
import { space } from '@/ui/theme';
import { CompleteHint } from './CompleteHint';
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
  /** No side padding, for a pane whose container already brings the gutter. */
  flush?: boolean;
  /** The list's first row: it carries the «tap the box» hint until the first completion. */
  first?: boolean;
};

/** One list row: an open task as a note (opens its form), or the tray of finished ones. */
export function TaskRow({
  row,
  today,
  marks,
  names,
  userId,
  isBusy,
  toggle,
  flush = false,
  first = false,
}: Props) {
  const router = useRouter();
  const notify = useNotice();
  const hint = useCompleteHint() && first && row.kind === 'note';
  const openTask = (id: string) => router.push({ pathname: '/task/[id]', params: { id } });
  return (
    <View style={{ paddingHorizontal: flush ? 0 : space(5) }}>
      {hint ? <CompleteHint /> : null}
      {row.kind === 'note' ? (
        <TaskNote
          task={row.task}
          today={today}
          mark={row.task.assigneeId ? marks.get(row.task.assigneeId) : undefined}
          assigneeName={row.task.assigneeId ? names.get(row.task.assigneeId) : undefined}
          busy={isBusy(row.task.id)}
          // Tapping the magnet or swiping completes the same way: both offer «Deshacer».
          onToggle={() =>
            row.task.completedAt === null
              ? completeWithUndo({ toggle, notify, task: row.task })
              : toggle({ id: row.task.id, done: false })
          }
          onComplete={() => completeWithUndo({ toggle, notify, task: row.task })}
          onOpen={() => openTask(row.task.id)}
        />
      ) : (
        <DoneTray
          tasks={row.tasks}
          marks={marks}
          names={names}
          userId={userId}
          today={today}
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
