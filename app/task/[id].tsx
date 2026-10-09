import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { memberMarks } from '@/domain/members/marks';
import type { TaskItem } from '@/domain/tasks/views';
import { useSession } from '@/features/auth/SessionProvider';
import { useMembers, useMembership } from '@/features/households/queries';
import { deleteTask, updateTask, type TaskInput } from '@/features/tasks/api';
import { TaskForm } from '@/features/tasks/components/TaskForm';
import { taskErrorMessage } from '@/features/tasks/errors';
import { useTaskMutation, useTasks } from '@/features/tasks/queries';
import { useToday } from '@/features/tasks/useToday';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { ErrorText } from '@/ui/components/ErrorText';
import { Screen } from '@/ui/components/Screen';
import { useTheme } from '@/ui/theme';

export default function EditTaskScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();
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
  const failure = remove.error ?? save.error;
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
        saving={save.isPending || save.isSuccess || remove.isPending || remove.isSuccess}
        error={failure ? taskErrorMessage(failure) : null}
        onCancel={close}
        onSave={(input) => {
          remove.reset();
          save.submit({ input }, { onSuccess: close });
        }}
        footer={
          canDelete ? (
            <Button
              testID="task-form.delete"
              title={t('taskForm.delete')}
              variant="danger"
              // A saved edit is already closing the modal: no confirm dialog on top of it.
              disabled={save.isPending || save.isSuccess || remove.isSuccess}
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
