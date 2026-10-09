import type { TaskItem } from './views';

/** Returns the list with one task completed or reopened; the others keep their reference. */
export function applyToggle(
  tasks: TaskItem[],
  id: string,
  done: boolean,
  userId: string,
  nowIso: string,
): TaskItem[] {
  if (!tasks.some((task) => task.id === id)) return tasks;
  return tasks.map((task) =>
    task.id === id
      ? { ...task, completedAt: done ? nowIso : null, completedBy: done ? userId : null }
      : task,
  );
}
