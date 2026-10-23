import { useRouter } from 'expo-router';
import { View } from 'react-native';
import type { MemberMark } from '@/domain/members/marks';
import type { TaskListRow } from '@/features/tasks/sections';
import { useUnsentTasks, type ToggleRequest } from '@/features/tasks/queries';
import { useHint } from '@/features/hints/hints';
import { completeWithUndo, reopenWithUndo } from '@/features/tasks/undo';
import { FirstUseHint } from '@/ui/components/FirstUseHint';
import { useNotice } from '@/ui/components/Notice';
import { space } from '@/ui/theme';
import { t } from '@/i18n';
import { DoneTray } from './DoneTray';
import { TaskNote } from './TaskNote';

type Props = {
  row: TaskListRow;
  today: string;
  marks: Map<string, MemberMark>;
  names: Map<string, string>;
  userId: string | null;
  isBusy: (id: string) => boolean;
  toggle: (vars: ToggleRequest) => boolean;
  /** No side padding, for a pane whose container already brings the gutter. */
  flush?: boolean;
  /** The list's first row: it carries the box hint, then the swipe one, until each is used. */
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
  const boxHint = useHint('complete');
  const swipeHint = useHint('swipe');
  // One hint over the list at a time: the box first, then the swipe.
  const hint =
    !first || row.kind !== 'note' ? null : boxHint ? 'complete' : swipeHint ? 'swipe' : null;
  const unsent = useUnsentTasks();
  // A note created here and still waiting for the connection is not on the server yet: its sheet
  // waits until it is (fase 10e). Ticking it off still works: it queues behind its create.
  const openTask = (id: string) => {
    if (unsent.has(id)) {
      notify(t('tasks.unsent'));
      return;
    }
    router.push({ pathname: '/task/[id]', params: { id } });
  };
  return (
    <View style={{ paddingHorizontal: flush ? 0 : space(5) }}>
      {hint === null ? null : (
        <View style={{ paddingBottom: space(1.5) }}>
          {hint === 'complete' ? (
            <FirstUseHint
              testID="tasks.complete-hint"
              text={t('tasks.completeHint')}
              arrow="arrow-down"
              align="right"
            />
          ) : (
            <FirstUseHint
              testID="tasks.swipe-hint"
              text={t('tasks.swipeHint')}
              readerText={t('tasks.swipeHintReader')}
              arrow="arrow-forward"
              align="right"
            />
          )}
        </View>
      )}
      {row.kind === 'note' ? (
        <TaskNote
          task={row.task}
          today={today}
          mark={row.task.assigneeId ? marks.get(row.task.assigneeId) : undefined}
          assigneeName={row.task.assigneeId ? names.get(row.task.assigneeId) : undefined}
          mine={row.task.assigneeId !== null && row.task.assigneeId === userId}
          busy={isBusy(row.task.id)}
          // Tapping the box or swiping completes the same way, and reopening too: all offer «Deshacer».
          onToggle={() =>
            row.task.completedAt === null
              ? completeWithUndo({ toggle, notify, task: row.task })
              : reopenWithUndo({ toggle, notify, task: row.task })
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
          onReopen={(task) => reopenWithUndo({ toggle, notify, task })}
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
