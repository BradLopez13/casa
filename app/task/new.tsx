import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { memberMarks } from '@/domain/members/marks';
import { useSession } from '@/features/auth/SessionProvider';
import { useMembers, useMembership } from '@/features/households/queries';
import { createTask, newTaskId, type TaskInput } from '@/features/tasks/api';
import { TaskForm } from '@/features/tasks/components/TaskForm';
import { taskErrorMessage } from '@/features/tasks/errors';
import { useTaskMutation } from '@/features/tasks/queries';
import { useToday } from '@/features/tasks/useToday';
import { t } from '@/i18n';

export default function NewTaskScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ assignee?: string }>();
  const today = useToday();
  const { userId } = useSession();
  const householdId = useMembership().data?.householdId;
  const members = useMembers(householdId).data;
  const marks = useMemo(() => memberMarks(members ?? []), [members]);
  // One id per form: a retried or repeated create returns the same task instead of a copy.
  const [id] = useState(newTaskId);
  const save = useTaskMutation(({ input }: { input: TaskInput }) =>
    createTask(id, householdId as string, input),
  );

  const initial: TaskInput = {
    title: '',
    room: null,
    assigneeId: params.assignee ?? null,
    dueOn: today,
    recurrence: null,
  };

  return (
    <TaskForm
      title={t('taskForm.newTitle')}
      initial={initial}
      members={members ?? []}
      marks={marks}
      userId={userId}
      today={today}
      saving={save.isPending || save.isSuccess}
      repeatEditable
      error={save.error ? taskErrorMessage(save.error) : null}
      onCancel={() => router.back()}
      onSave={(input) => {
        if (householdId === undefined) return;
        save.submit({ input }, { onSuccess: () => router.back() });
      }}
    />
  );
}
