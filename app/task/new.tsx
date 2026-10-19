import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { memberMarks } from '@/domain/members/marks';
import { useSession } from '@/features/auth/SessionProvider';
import { useMembers, useMembership } from '@/features/households/queries';
import { createTask, newTaskId, type TaskInput } from '@/features/tasks/api';
import { markFresh } from '@/features/tasks/freshIds';
import { dueParam } from '@/features/tasks/dueParam';
import { TaskForm } from '@/features/tasks/components/TaskForm';
import { taskErrorMessage } from '@/features/tasks/errors';
import { useTaskMutation } from '@/features/tasks/queries';
import { useToday } from '@/features/tasks/useToday';
import { t } from '@/i18n';
import { ModalSheet } from '@/ui/components/ModalSheet';
import { useCloseModal } from '@/ui/useCloseModal';
import { announce } from '@/ui/a11y';

/** Mounted once inside its frame, so rotating never remounts the form. */
export default function NewTaskRoute() {
  return (
    <ModalSheet>
      <NewTaskScreen />
    </ModalSheet>
  );
}

function NewTaskScreen() {
  const close = useCloseModal('/today');
  const params = useLocalSearchParams<{ assignee?: string; due?: string }>();
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
    dueOn: dueParam(params.due, today),
    recurrence: null,
  };

  return (
    <TaskForm
      title={t('taskForm.newTitle')}
      isNew
      initial={initial}
      members={members ?? []}
      marks={marks}
      userId={userId}
      today={today}
      saving={save.isPending || save.isSuccess}
      repeatEditable
      error={save.error ? taskErrorMessage(save.error) : null}
      onCancel={close}
      onSave={(input) => {
        if (householdId === undefined) return;
        // Created here: its note lands with the pin choreography on the list behind.
        markFresh(id);
        save.submit(
          { input },
          {
            onSuccess: () => {
              announce(t('tasks.a11y.added', { title: input.title }));
              close();
            },
          },
        );
      }}
    />
  );
}
