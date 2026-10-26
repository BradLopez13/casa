import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { memberMarks } from '@/domain/members/marks';
import { useSession } from '@/features/auth/SessionProvider';
import { useMembers, useMembership } from '@/features/households/queries';
import { newTaskId, type TaskInput } from '@/features/tasks/api';
import { buildCreateOptions } from '@/features/tasks/create';
import { markFresh } from '@/features/tasks/freshIds';
import { assigneeParam, dueParam } from '@/features/tasks/dueParam';
import { TaskForm } from '@/features/tasks/components/TaskForm';
import { NO_DATE } from '@/features/tasks/components/QuickAdd';
import { useToday } from '@/features/tasks/useToday';
import { t } from '@/i18n';
import { ModalSheet } from '@/ui/components/ModalSheet';
import { useNotice } from '@/ui/components/Notice';
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
  // Queued like the quick add (bloque 11, T6): the note shows at once, without a connection the
  // create waits for it, and a final error takes the note away and says so.
  const queryClient = useQueryClient();
  const notify = useNotice();
  const create = useMutation(buildCreateOptions(queryClient, notify));

  const initial: TaskInput = {
    title: '',
    room: null,
    assigneeId: assigneeParam(params.assignee),
    // From Tareas' «Todas» the «+» opens it without a date (bloque 11).
    dueOn: params.due === NO_DATE ? null : dueParam(params.due, today),
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
      saving={create.isPending || create.isSuccess}
      repeatEditable
      error={null}
      onCancel={close}
      onSave={(input) => {
        if (householdId === undefined) return;
        // Created here: its note lands with the pin choreography on the list behind.
        markFresh(id);
        create.mutate({ id, householdId, userId, input });
        announce(t('tasks.a11y.added', { title: input.title }));
        close();
      }}
    />
  );
}
