import { useMemo, useState } from 'react';
import { filterByAssignee, type TaskItem } from '@/domain/tasks/views';
import { useSession } from '@/features/auth/SessionProvider';
import { useMembers, useMembership } from '@/features/households/queries';
import { useTaskFilter } from './filter';
import { useTasks, useToggleTask } from './queries';
import { useMemberLabels } from './useMemberLabels';
import { useToday } from './useToday';

const NO_TASKS: TaskItem[] = [];

/** What Hoy and Tareas share: the household, its members and tasks, the filter and pull-to-refresh. */
export function useTaskScreen() {
  const today = useToday();
  const { userId } = useSession();
  const membership = useMembership().data;
  const householdId = membership?.householdId;
  const membersQuery = useMembers(householdId);
  const tasksQuery = useTasks(householdId);
  const { toggle, isBusy } = useToggleTask(householdId, userId);
  const filter = useTaskFilter();
  // Only the pull gesture shows the refresh indicator, not background refetches.
  const [pulling, setPulling] = useState(false);

  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const tasks = tasksQuery.data ?? NO_TASKS;
  // A filter on someone who has left the household falls back to the whole household.
  const assigneeId = members.some((m) => m.userId === filter.assigneeId) ? filter.assigneeId : null;

  const { marks, names } = useMemberLabels(members, userId);
  const filtered = useMemo(() => filterByAssignee(tasks, assigneeId), [tasks, assigneeId]);

  const refresh = async () => {
    // refetch() ignores `enabled`, so never fire the queries without a household.
    if (householdId === undefined) return;
    setPulling(true);
    try {
      await Promise.all([tasksQuery.refetch(), membersQuery.refetch()]);
    } finally {
      setPulling(false);
    }
  };

  return {
    today,
    userId,
    membership,
    members,
    tasksQuery,
    assigneeId,
    toggleFilter: filter.toggle,
    filtered,
    marks,
    names,
    toggle,
    isBusy,
    pulling,
    refresh,
  };
}
