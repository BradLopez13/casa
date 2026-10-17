import type { RepeatChoice } from '@/domain/recurrence/form';
import { t } from '@/i18n';

/**
 * The text of a «Se repite» pill. The interval one says «Cada 3 días» once chosen, and invites a
 * number («Cada pocos días…») while it is not; the others keep their plain label.
 */
export function repeatPillText(choice: RepeatChoice, every: number | null): string {
  if (choice === 'interval' && every !== null)
    return t('taskForm.repeat.intervalValue', { n: every });
  return t(`taskForm.repeat.${choice}`);
}
