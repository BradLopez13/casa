import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type TaskFilter = { assigneeId: string | null; toggle: (userId: string) => void };

const TaskFilterContext = createContext<TaskFilter | null>(null);

/** The member filter shared by Hoy and Tareas. It lives in memory and is not persisted. */
export function TaskFilterProvider({ children }: { children: ReactNode }) {
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const toggle = useCallback(
    (userId: string) => setAssigneeId((current) => (current === userId ? null : userId)),
    [],
  );
  const value = useMemo(() => ({ assigneeId, toggle }), [assigneeId, toggle]);
  return <TaskFilterContext.Provider value={value}>{children}</TaskFilterContext.Provider>;
}

export function useTaskFilter(): TaskFilter {
  const value = useContext(TaskFilterContext);
  if (!value) throw new Error('useTaskFilter must be used inside TaskFilterProvider');
  return value;
}
