import { t } from '@/i18n';

/** What the form says when Save is pressed and something is missing. */
export function saveErrorText(code: 'INVALID_TITLE' | 'RECURRENCE_NEEDS_DATE'): string {
  return code === 'INVALID_TITLE'
    ? t('taskForm.titleRequired')
    : t('tasks.errors.RECURRENCE_NEEDS_DATE');
}

/** A picker of the form: what Save opens so a wrong value can be fixed there. */
export type FormPicker = 'room' | 'assignee' | 'repeat';

/**
 * What Save says, and which picker it opens, when a property other than the title or the date
 * cannot be saved (a link that gave the task to someone not in the household): before, Save did
 * nothing and said nothing.
 */
export function invalidFieldError(field: string): { text: string; open: FormPicker | null } {
  switch (field) {
    case 'assigneeId':
      return { text: t('tasks.errors.INVALID_ASSIGNEE'), open: 'assignee' };
    case 'room':
      return { text: t('tasks.errors.INVALID_ROOM'), open: 'room' };
    case 'recurrence':
      return { text: t('tasks.errors.INVALID_RECURRENCE'), open: 'repeat' };
    default:
      return { text: t('tasks.errors.UNKNOWN'), open: null };
  }
}
