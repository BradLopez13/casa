import { t } from '@/i18n';

/** What the form says when Save is pressed and something is missing. */
export function saveErrorText(code: 'INVALID_TITLE' | 'RECURRENCE_NEEDS_DATE'): string {
  return code === 'INVALID_TITLE'
    ? t('taskForm.titleRequired')
    : t('tasks.errors.RECURRENCE_NEEDS_DATE');
}
