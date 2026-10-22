import { describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import type { NoticeAction } from '@/ui/components/Notice';
import { completeWithUndo, reopenWithUndo } from './undo';

describe('completeWithUndo', () => {
  it('completes the task and offers an undo that reopens it', () => {
    const toggle = vi.fn(() => true);
    const notify = vi.fn<(message: string, action?: NoticeAction) => void>();
    completeWithUndo({ toggle, notify, task: { id: 't1' } });

    expect(toggle).toHaveBeenCalledTimes(1);
    expect(toggle).toHaveBeenCalledWith({ id: 't1', done: true });
    expect(notify).toHaveBeenCalledTimes(1);
    const [message, action] = notify.mock.calls[0]!;
    expect(message).toBe(t('tasks.done'));
    expect(action?.label).toBe(t('tasks.undo'));
    expect(action?.testID).toBe('notice.undo');

    action?.onPress();
    expect(toggle).toHaveBeenLastCalledWith({ id: 't1', done: false });
  });

  it('offers nothing when the toggle did not go', () => {
    const toggle = vi.fn(() => false);
    const notify = vi.fn<(message: string, action?: NoticeAction) => void>();
    completeWithUndo({ toggle, notify, task: { id: 't1' } });
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('reopenWithUndo', () => {
  it('reopens the task and offers an undo that marks it done again', () => {
    const toggle = vi.fn(() => true);
    const notify = vi.fn<(message: string, action?: NoticeAction) => void>();
    reopenWithUndo({ toggle, notify, task: { id: 't1' } });

    expect(toggle).toHaveBeenCalledWith({ id: 't1', done: false });
    const [message, action] = notify.mock.calls[0]!;
    expect(message).toBe(t('tasks.reopened'));
    expect(action?.label).toBe(t('tasks.undo'));
    expect(action?.testID).toBe('notice.undo');

    action?.onPress();
    expect(toggle).toHaveBeenLastCalledWith({ id: 't1', done: true });
  });

  it('offers nothing when the toggle did not go', () => {
    const toggle = vi.fn(() => false);
    const notify = vi.fn<(message: string, action?: NoticeAction) => void>();
    reopenWithUndo({ toggle, notify, task: { id: 't1' } });
    expect(notify).not.toHaveBeenCalled();
  });
});
