import { t } from '@/i18n';
import type { NoticeAction } from '@/ui/components/Notice';
import { markHintSeen } from './completeHint';
import type { ToggleVars } from './toggle';

type Args = {
  toggle: (vars: ToggleVars) => void;
  notify: (message: string, action?: NoticeAction) => void;
  task: { id: string };
};

/** Completes a task and offers «Deshacer» in the notice, which reopens it. */
export function completeWithUndo({ toggle, notify, task }: Args): void {
  toggle({ id: task.id, done: true });
  markHintSeen();
  notify(t('tasks.done'), {
    label: t('tasks.undo'),
    onPress: () => toggle({ id: task.id, done: false }),
    testID: 'notice.undo',
  });
}
