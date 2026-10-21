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

/** Completes a task and offers «Deshacer» in the notice, which reopens it. */
export function completeWithUndo({ toggle, notify, task }: Args): void {
  if (!toggle({ id: task.id, done: true })) return;
  markHintSeen('complete');
  notify(t('tasks.done'), {
    label: t('tasks.undo'),
    onPress: () => toggle({ id: task.id, done: false }),
    testID: 'notice.undo',
  });
}
