import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { nextFilter } from './filterState';

type TaskFilter = { assigneeId: string | null; select: (userId: string | null) => void };

const TaskFilterContext = createContext<TaskFilter | null>(null);

/** The member filter shared by Hoy and Tareas. It lives in memory and is not persisted. */
export function TaskFilterProvider({ children }: { children: ReactNode }) {
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const select = useCallback(
    (userId: string | null) => setAssigneeId((current) => nextFilter(current, userId)),
    [],
  );
  const value = useMemo(() => ({ assigneeId, select }), [assigneeId, select]);
  return <TaskFilterContext.Provider value={value}>{children}</TaskFilterContext.Provider>;
}

export function useTaskFilter(): TaskFilter {
  const value = useContext(TaskFilterContext);
  if (!value) throw new Error('useTaskFilter must be used inside TaskFilterProvider');
  return value;
}
