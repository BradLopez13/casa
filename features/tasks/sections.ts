import { addDays, isoWeekday } from '@/domain/tasks/dates';
import { selectAll, selectToday, type TaskItem } from '@/domain/tasks/views';
import { t } from '@/i18n';

/** One row of a task list: a note per open task, or the tray holding every finished one. */
export type TaskListRow = { kind: 'note'; task: TaskItem } | { kind: 'tray'; tasks: TaskItem[] };
export type TaskListSection = { key: string; title: string; count: number; data: TaskListRow[] };

/**
 * A section of notes. A task whose «Deshacer» is still up (`going`) counts as it was, as in the
 * headline (bloque 15.3, P3-4), but has no row: the note already left the list.
 */
const notes = (
  key: string,
  title: string,
  tasks: TaskItem[],
  going: ReadonlySet<string> = new Set(),
): TaskListSection => ({
  key,
  title,
  count: tasks.length,
  data: tasks.flatMap((task): TaskListRow[] =>
    going.has(task.id) ? [] : [{ kind: 'note', task }],
  ),
});

export const tray = (key: string, title: string, tasks: TaskItem[]): TaskListSection => ({
  key,
  title,
  count: tasks.length,
  data: [{ kind: 'tray', tasks }],
});

/** Empty sections are left out, so the list never shows a heading with nothing under it. */
const nonEmpty = (sections: TaskListSection[]) => sections.filter((section) => section.count > 0);

/** The tasks with those whose «Deshacer» is still up, and the ids of the latter. */
export function withGoing(
  tasks: TaskItem[],
  deleting: readonly TaskItem[],
): { all: TaskItem[]; going: ReadonlySet<string> } {
  if (deleting.length === 0) return { all: tasks, going: new Set() };
  return { all: [...tasks, ...deleting], going: new Set(deleting.map((task) => task.id)) };
}

/** Hoy: due today first, then the calm overdue block (first when nothing is due today), and the tray of what was finished today. */
export function todaySections(
  tasks: TaskItem[],
  today: string,
  deleting: readonly TaskItem[] = [],
): TaskListSection[] {
  const { all, going } = withGoing(tasks, deleting);
  const { overdue, dueToday, doneToday } = selectToday(all, today);
  return nonEmpty([
    ...(dueToday.length > 0
      ? [
          notes('today', t('tasks.section.today'), dueToday, going),
          notes('overdue', t('tasks.section.overdue'), overdue, going),
        ]
      : [notes('overdue', t('tasks.section.overdue'), overdue, going)]),
    tray('doneToday', t('tasks.section.doneToday'), doneToday),
  ]);
}

/**
 * Tareas › Todas, grouped by date so it does not repeat Hoy (fase 10c): earlier days, today, the
 * rest of this week (to Sunday), later, no date, and the tray of everything finished.
 */
export function allSections(
  tasks: TaskItem[],
  today: string,
  deleting: readonly TaskItem[] = [],
): TaskListSection[] {
  const { all, going } = withGoing(tasks, deleting);
  const { dated, undated, done } = selectAll(all, today);
  const sunday = addDays(today, 7 - isoWeekday(today));
  const group = (keep: (dueOn: string) => boolean) =>
    dated.filter((task) => task.dueOn !== null && keep(task.dueOn));
  return nonEmpty([
    notes(
      'overdue',
      t('tasks.section.overdue'),
      group((due) => due < today),
      going,
    ),
    notes(
      'today',
      t('tasks.section.allToday'),
      group((due) => due === today),
      going,
    ),
    notes(
      'thisWeek',
      t('tasks.section.thisWeek'),
      group((due) => due > today && due <= sunday),
      going,
    ),
    notes(
      'later',
      t('tasks.section.later'),
      group((due) => due > sunday),
      going,
    ),
    notes('undated', t('tasks.section.undated'), undated, going),
    tray('done', t('tasks.section.done'), done),
  ]);
}
