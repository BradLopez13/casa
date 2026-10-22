import { t } from '@/i18n';
import type { NoticeAction } from '@/ui/components/Notice';
import { markHintSeen } from '@/features/hints/hints';
import type { ToggleVars } from './toggle';

type Args = {
  /** False when it did not go (offline): the toggle has already said why. */
  toggle: (vars: ToggleVars) => boolean;
  notify: (message: string, action?: NoticeAction) => void;
  task: { id: string };
};

/** Completes a task and offers «Deshacer» in the notice, which reopens it. False if it did not go. */
export function completeWithUndo({ toggle, notify, task }: Args): boolean {
  if (!toggle({ id: task.id, done: true })) return false;
  markHintSeen('complete');
  notify(t('tasks.done'), {
    label: t('tasks.undo'),
    onPress: () => toggle({ id: task.id, done: false }),
    testID: 'notice.undo',
  });
  return true;
}

/** Reopens a done task and offers «Deshacer» in the notice, which marks it done again. */
export function reopenWithUndo({ toggle, notify, task }: Args): boolean {
  if (!toggle({ id: task.id, done: false })) return false;
  notify(t('tasks.reopened'), {
    label: t('tasks.undo'),
    onPress: () => toggle({ id: task.id, done: true }),
    testID: 'notice.undo',
  });
  return true;
}
