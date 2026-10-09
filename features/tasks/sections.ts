import { dayHeading } from '@/domain/tasks/labels';
import { selectAll, selectToday, type selectWeek, type TaskItem } from '@/domain/tasks/views';
import { t } from '@/i18n';

/** One row of a task list: a note per open task, or the tray holding every finished one. */
export type TaskListRow = { kind: 'note'; task: TaskItem } | { kind: 'tray'; tasks: TaskItem[] };
export type TaskListSection = { key: string; title: string; count: number; data: TaskListRow[] };

const notes = (key: string, title: string, tasks: TaskItem[]): TaskListSection => ({
  key,
  title,
  count: tasks.length,
  data: tasks.map((task): TaskListRow => ({ kind: 'note', task })),
});

const tray = (key: string, title: string, tasks: TaskItem[]): TaskListSection => ({
  key,
  title,
  count: tasks.length,
  data: [{ kind: 'tray', tasks }],
});

/** Empty sections are left out, so the list never shows a heading with nothing under it. */
const nonEmpty = (sections: TaskListSection[]) => sections.filter((section) => section.count > 0);

/** Hoy: overdue, due today, and the tray of what was finished today. */
export function todaySections(tasks: TaskItem[], today: string): TaskListSection[] {
  const { overdue, dueToday, doneToday } = selectToday(tasks, today);
  return nonEmpty([
    notes('overdue', t('tasks.section.overdue'), overdue),
    notes('today', t('tasks.section.today'), dueToday),
    tray('doneToday', t('tasks.section.doneToday'), doneToday),
  ]);
}

/** Tareas › Semana: overdue, then one section per day keyed by its date (the strip scrolls to it). */
export function weekSections(
  week: ReturnType<typeof selectWeek>,
  today: string,
): TaskListSection[] {
  return nonEmpty([
    notes('overdue', t('tasks.section.overdue'), week.overdue),
    ...week.days.map((day) => notes(day.date, dayHeading(day.date, today), day.tasks)),
  ]);
}

/** Tareas › Todas: dated, undated, and the tray of everything finished. */
export function allSections(tasks: TaskItem[], today: string): TaskListSection[] {
  const { dated, undated, done } = selectAll(tasks, today);
  return nonEmpty([
    notes('dated', t('tasks.section.dated'), dated),
    notes('undated', t('tasks.section.undated'), undated),
    tray('done', t('tasks.section.done'), done),
  ]);
}
