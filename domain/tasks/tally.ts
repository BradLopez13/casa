import { selectToday, type TaskItem } from './views';

export type Tally = { done: number; total: number };

export function tallyToday(tasks: TaskItem[], today: string): Tally {
  const { overdue, dueToday, doneToday } = selectToday(tasks, today);
  return { done: doneToday.length, total: overdue.length + dueToday.length + doneToday.length };
}
