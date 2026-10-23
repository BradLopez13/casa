import { addDays, isoWeekday } from '@/domain/tasks/dates';
import { selectAll, selectToday, type TaskItem } from '@/domain/tasks/views';
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

/** Hoy: due today first, then the calm overdue block (first when nothing is due today), and the tray of what was finished today. */
export function todaySections(tasks: TaskItem[], today: string): TaskListSection[] {
  const { overdue, dueToday, doneToday } = selectToday(tasks, today);
  return nonEmpty([
    ...(dueToday.length > 0
      ? [
          notes('today', t('tasks.section.today'), dueToday),
          notes('overdue', t('tasks.section.overdue'), overdue),
        ]
      : [notes('overdue', t('tasks.section.overdue'), overdue)]),
    tray('doneToday', t('tasks.section.doneToday'), doneToday),
  ]);
}

/**
 * Tareas › Todas, grouped by date so it does not repeat Hoy (fase 10c): earlier days, today, the
 * rest of this week (to Sunday), later, no date, and the tray of everything finished.
 */
export function allSections(tasks: TaskItem[], today: string): TaskListSection[] {
  const { dated, undated, done } = selectAll(tasks, today);
  const sunday = addDays(today, 7 - isoWeekday(today));
  const group = (keep: (dueOn: string) => boolean) =>
    dated.filter((task) => task.dueOn !== null && keep(task.dueOn));
  return nonEmpty([
    notes(
      'overdue',
      t('tasks.section.overdue'),
      group((due) => due < today),
    ),
    notes(
      'today',
      t('tasks.section.allToday'),
      group((due) => due === today),
    ),
    notes(
      'thisWeek',
      t('tasks.section.thisWeek'),
      group((due) => due > today && due <= sunday),
    ),
    notes(
      'later',
      t('tasks.section.later'),
      group((due) => due > sunday),
    ),
    notes('undated', t('tasks.section.undated'), undated),
    tray('done', t('tasks.section.done'), done),
  ]);
}
