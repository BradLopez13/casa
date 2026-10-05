import { locale, t } from '@/i18n';
import { addDays } from './dates';

/** Human label for a due date: relative for yesterday..tomorrow, else a long local date. */
export function dueLabel(dueOn: string | null, today: string): string {
  if (dueOn === null) return t('tasks.due.none');
  if (dueOn === today) return t('tasks.due.today');
  if (dueOn === addDays(today, 1)) return t('tasks.due.tomorrow');
  if (dueOn === addDays(today, -1)) return t('tasks.due.yesterday');
  const [y, m, d] = dueOn.split('-').map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
