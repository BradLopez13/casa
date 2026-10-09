import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { memberMarks } from '@/domain/members/marks';
import { calculateNextOccurrence } from '@/domain/recurrence/next';
import { dayHeading } from '@/domain/tasks/labels';
import { isProvisional } from '@/domain/tasks/optimistic';
import type { TaskItem } from '@/domain/tasks/views';
import { useSession } from '@/features/auth/SessionProvider';
import { useMembers, useMembership } from '@/features/households/queries';
import { deleteTask, updateTask, type TaskInput } from '@/features/tasks/api';
import { TaskForm } from '@/features/tasks/components/TaskForm';
import { taskErrorMessage } from '@/features/tasks/errors';
import { useSkipTask, useTaskMutation, useTasks } from '@/features/tasks/queries';
import { useToday } from '@/features/tasks/useToday';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { ErrorText } from '@/ui/components/ErrorText';
import { useNotice } from '@/ui/components/Notice';
import { Screen } from '@/ui/components/Screen';
import { useTheme } from '@/ui/theme';

export default function EditTaskScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();
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
  const close = () => router.back();

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
            <Button testID="task-form.close" title={t('taskForm.close')} onPress={close} />
          </>
        )}
      </Screen>
    );
  }

  const canDelete = task.createdBy === userId || membership?.role === 'owner';
  const failure = skip.error ?? remove.error ?? save.error;
  // Saving, deleting or skipping locks the other two, and a success keeps them locked while closing.
  const busy =
    save.isPending ||
    save.isSuccess ||
    remove.isPending ||
    remove.isSuccess ||
    skip.isPending ||
    skip.isSuccess;
  const canSkip =
    task.recurrence !== null &&
    task.completedAt === null &&
    task.skippedAt === null &&
    !isProvisional(task);
  const skipOnce = () => {
    if (task.recurrence === null) return;
    // The occurrence the server creates next, as it computes it from the same date and today.
    const next = calculateNextOccurrence(task.recurrence, task.dueOn ?? today, today);
    save.reset();
    remove.reset();
    skip.submit(id, {
      onSuccess: () => {
        close();
        notify(t('tasks.skipped', { date: dayHeading(next, today).toLowerCase() }));
      },
    });
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
          save.submit({ input }, { onSuccess: close });
        }}
        footer={
          canSkip || canDelete ? (
            <View style={{ gap: space(3) }}>
              {canSkip ? (
                <Button
                  testID="task-form.skip"
                  title={t('taskForm.skip')}
                  variant="secondary"
                  disabled={busy}
                  onPress={skipOnce}
                />
              ) : null}
              {canDelete ? (
                <Button
                  testID="task-form.delete"
                  title={t('taskForm.delete')}
                  variant="danger"
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
              ) : null}
            </View>
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
