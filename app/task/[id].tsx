import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { memberMarks } from '@/domain/members/marks';
import { calculateNextOccurrence } from '@/domain/recurrence/next';
import { skippedNotice } from '@/domain/tasks/labels';
import { isProvisional } from '@/domain/tasks/optimistic';
import type { TaskItem } from '@/domain/tasks/views';
import { useSession } from '@/features/auth/SessionProvider';
import { useMembers, useMembership } from '@/features/households/queries';
import { deleteTask, updateTask, type TaskInput } from '@/features/tasks/api';
import { markHintSeen } from '@/features/tasks/completeHint';
import { TaskForm } from '@/features/tasks/components/TaskForm';
import { taskErrorMessage } from '@/features/tasks/errors';
import { useSkipTask, useTaskMutation, useTasks, useToggleTask } from '@/features/tasks/queries';
import { useToday } from '@/features/tasks/useToday';
import { t } from '@/i18n';
import { actionIcons } from '@/ui/actionIcons';
import { Button } from '@/ui/components/Button';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { ErrorText } from '@/ui/components/ErrorText';
import { ModalSheet } from '@/ui/components/ModalSheet';
import { useNotice } from '@/ui/components/Notice';
import { Screen } from '@/ui/components/Screen';
import { useTheme } from '@/ui/theme';
import { useCloseModal } from '@/ui/useCloseModal';
import { announce } from '@/ui/a11y';

/** Mounted once inside its frame, so rotating never remounts the form. */
export default function EditTaskRoute() {
  return (
    <ModalSheet>
      <EditTaskScreen />
    </ModalSheet>
  );
}

function EditTaskScreen() {
  const { colors, space } = useTheme();
  const notify = useNotice();
  const { id } = useLocalSearchParams<{ id: string }>();
  const today = useToday();
  const { userId } = useSession();
  const membership = useMembership().data;
  const householdId = membership?.householdId;
  const members = useMembers(householdId).data;
  const marks = useMemo(() => memberMarks(members ?? []), [members]);
  const tasksQuery = useTasks(householdId);
  const found = tasksQuery.data?.find((task) => task.id === id);

  // Keep the last task seen, so the form stays put while a successful delete closes the modal
  // (the refreshed list no longer has it).
  const [task, setTask] = useState<TaskItem | undefined>(found);
  if (found !== undefined && found !== task) setTask(found);

  const [confirming, setConfirming] = useState(false);
  const save = useTaskMutation(({ input }: { input: TaskInput }) => updateTask(id, input));
  const remove = useTaskMutation<void, void>(() => deleteTask(id));
  const skip = useSkipTask(householdId);
  const toggler = useToggleTask(householdId, userId);
  const close = useCloseModal('/today');
  // Completing or reopening from the form closes it, but only after a render that marks the form
  // busy: closing in the same tick let the discard guard ask over a task already toggled.
  const [toggled, setToggled] = useState(false);
  useEffect(() => {
    if (toggled) close();
  }, [toggled]); // eslint-disable-line react-hooks/exhaustive-deps

  if (task === undefined) {
    const loading = tasksQuery.data === undefined && !tasksQuery.isError;
    return (
      <Screen>
        {loading ? (
          <View style={{ paddingVertical: space(6), alignItems: 'center' }}>
            <ActivityIndicator color={colors.muted} accessibilityLabel={t('members.loading')} />
          </View>
        ) : (
          <>
            <ErrorText testID="task-form.not-found">
              {tasksQuery.data === undefined
                ? taskErrorMessage(tasksQuery.error)
                : t('tasks.errors.TASK_NOT_FOUND')}
            </ErrorText>
            <Button
              testID="task-form.close"
              title={t('taskForm.close')}
              variant="tertiary"
              icon={actionIcons.close}
              onPress={close}
            />
          </>
        )}
      </Screen>
    );
  }

  const canDelete = task.createdBy === userId || membership?.role === 'owner';
  const done = task.completedAt !== null;
  const toggling = toggler.isBusy(task.id) && !isProvisional(task);
  const failure = skip.error ?? remove.error ?? save.error;
  // Saving, deleting or skipping locks the other two, and a success keeps them locked while closing.
  const busy =
    save.isPending ||
    save.isSuccess ||
    remove.isPending ||
    remove.isSuccess ||
    skip.isPending ||
    skip.isSuccess ||
    toggling ||
    toggled;
  const canSkip =
    task.recurrence !== null &&
    task.completedAt === null &&
    task.skippedAt === null &&
    !isProvisional(task);
  const skipOnce = () => {
    if (task.recurrence === null) return;
    // The server computes the next occurrence from this same `today`, so the notice matches it.
    const next = calculateNextOccurrence(task.recurrence, task.dueOn ?? today, today);
    save.reset();
    remove.reset();
    skip.submit(
      { id, today },
      {
        onSuccess: () => {
          close();
          notify(skippedNotice(next, today));
        },
      },
    );
  };
  const toggleDone = () => {
    if (isProvisional(task)) return;
    save.reset();
    remove.reset();
    skip.reset();
    toggler.toggle({ id: task.id, done: !done });
    if (!done) markHintSeen();
    setToggled(true);
  };
  const initial: TaskInput = {
    title: task.title,
    room: task.room,
    assigneeId: task.assigneeId,
    dueOn: task.dueOn,
    recurrence: task.recurrence,
  };

  return (
    <>
      <TaskForm
        title={t('taskForm.editTitle')}
        isNew={false}
        initial={initial}
        members={members ?? []}
        marks={marks}
        userId={userId}
        today={today}
        saving={busy}
        error={failure ? taskErrorMessage(failure) : null}
        onCancel={close}
        onSave={(input) => {
          remove.reset();
          skip.reset();
          save.submit(
            { input },
            {
              onSuccess: () => {
                announce(t('tasks.a11y.saved'));
                close();
              },
            },
          );
        }}
        // A completed or skipped occurrence keeps its rule; it cannot start a series from there.
        repeatEditable={task.completedAt === null && task.skippedAt === null}
        // Save is the foot's one pósit: completing and reopening are outlined next to it, never grey.
        footer={
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(3) }}
          >
            <Button
              testID={done ? 'task-form.reopen' : 'task-form.complete'}
              title={t(done ? 'taskForm.reopen' : 'taskForm.complete')}
              icon={done ? undefined : actionIcons.confirm}
              variant="outlined"
              disabled={busy || isProvisional(task)}
              onPress={toggleDone}
            />
            {canSkip ? (
              <Button
                testID="task-form.skip"
                title={t('taskForm.skip')}
                icon={actionIcons.skip}
                variant="tertiary"
                disabled={busy}
                onPress={skipOnce}
              />
            ) : null}
          </View>
        }
        // Deleting stays apart from the foot, at the end of the note's scroll.
        dangerZone={
          canDelete ? (
            <Button
              testID="task-form.delete"
              title={t('taskForm.delete')}
              variant="tertiary"
              tone="destructive"
              icon={actionIcons.delete}
              // A saved edit or skip is already closing the modal: no confirm dialog on top.
              disabled={
                save.isPending ||
                save.isSuccess ||
                remove.isSuccess ||
                skip.isPending ||
                skip.isSuccess
              }
              onPress={() => setConfirming(true)}
            />
          ) : null
        }
      />
      <ConfirmDialog
        visible={confirming}
        title={t('taskForm.deleteTitle')}
        message={t('taskForm.deleteMessage')}
        confirmLabel={t('taskForm.delete')}
        destructive
        loading={remove.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          save.reset();
          skip.reset();
          remove.submit(undefined, {
            onSuccess: () => {
              setConfirming(false);
              close();
            },
            onError: () => setConfirming(false),
          });
        }}
      />
    </>
  );
}
