import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { nextFilter } from './filterState';

type TaskFilter = { assigneeId: string | null; select: (userId: string | null) => void };

const TaskFilterContext = createContext<TaskFilter | null>(null);

/**
 * The member filter shared by Hoy and Tareas. It lives in memory and is not persisted. It belongs
 * to one household: switching to another starts it again on Todos (bloque 12), since the person
 * chosen may not live there.
 */
export function TaskFilterProvider({
  householdId,
  children,
}: {
  householdId?: string;
  children: ReactNode;
}) {
  const [chosen, setChosen] = useState<{ householdId?: string; assigneeId: string | null }>({
    householdId,
    assigneeId: null,
  });
  const assigneeId = chosen.householdId === householdId ? chosen.assigneeId : null;
  const select = useCallback(
    (userId: string | null) =>
      setChosen((current) => ({
        householdId,
        assigneeId: nextFilter(
          current.householdId === householdId ? current.assigneeId : null,
          userId,
        ),
      })),
    [householdId],
  );
  const value = useMemo(() => ({ assigneeId, select }), [assigneeId, select]);
  return <TaskFilterContext.Provider value={value}>{children}</TaskFilterContext.Provider>;
}

export function useTaskFilter(): TaskFilter {
  const value = useContext(TaskFilterContext);
  if (!value) throw new Error('useTaskFilter must be used inside TaskFilterProvider');
  return value;
}
