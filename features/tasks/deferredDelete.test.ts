import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/data/supabase/errors';
import { t } from '@/i18n';
import type { NoticeAction } from '@/ui/components/Notice';
import { deleteWithUndo, hiddenTasks, showTask } from './deferredDelete';

function fakeClock() {
  let pending: (() => void) | null = null;
  return {
    schedule: (fn: () => void) => {
      pending = fn;
      return () => {
        pending = null;
      };
    },
    fire: () => pending?.(),
  };
}

function setup(remove = vi.fn(() => Promise.resolve())) {
  const clock = fakeClock();
  const notify = vi.fn<(message: string, action?: NoticeAction) => void>();
  const unwatch = vi.fn();
  let background: (() => void) | null = null;
  deleteWithUndo({
    id: 't1',
    remove,
    notify,
    ms: 5000,
    schedule: clock.schedule,
    watchBackground: (flush) => {
      background = flush;
      return unwatch;
    },
  });
  const action = notify.mock.calls[0]![1]!;
  return { clock, notify, remove, action, unwatch, background: () => background?.() };
}

afterEach(() => showTask('t1'));

describe('deleteWithUndo', () => {
  it('hides the task at once and offers «Deshacer» without asking the server', () => {
    const { notify, remove, action } = setup();
    expect(hiddenTasks.get().has('t1')).toBe(true);
    expect(notify.mock.calls[0]![0]).toBe(t('tasks.deleted'));
    expect(action.label).toBe(t('tasks.undo'));
    expect(action.testID).toBe('notice.undo');
    expect(remove).not.toHaveBeenCalled();
  });

  it('undo brings it back and never deletes', () => {
    const { clock, remove, action, unwatch } = setup();
    action.onPress();
    clock.fire();
    action.onExpire?.();
    expect(hiddenTasks.get().has('t1')).toBe(false);
    expect(remove).not.toHaveBeenCalled();
    expect(unwatch).toHaveBeenCalled();
  });

  it('deletes once when the window ends, then stops hiding it', async () => {
    const { clock, remove, action } = setup();
    clock.fire();
    action.onExpire?.();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith('t1');
    await Promise.resolve();
    await Promise.resolve();
    expect(hiddenTasks.get().has('t1')).toBe(false);
  });

  it('deletes when the notice goes away unused or the app goes to the background', () => {
    const first = setup();
    first.action.onExpire?.();
    expect(first.remove).toHaveBeenCalledTimes(1);
    showTask('t1');
    const second = setup();
    second.background();
    expect(second.remove).toHaveBeenCalledTimes(1);
  });

  it('puts the task back and says why when the delete fails', async () => {
    const remove = vi.fn(() => Promise.reject(new AppError('NETWORK')));
    const { clock, notify } = setup(remove);
    clock.fire();
    await vi.waitFor(() => expect(notify).toHaveBeenCalledTimes(2));
    expect(notify.mock.calls[1]![0]).toBe(t('tasks.deleteFailedOffline'));
    expect(hiddenTasks.get().has('t1')).toBe(false);
  });

  it('treats a task already gone as deleted', async () => {
    const remove = vi.fn(() => Promise.reject(new AppError('TASK_NOT_FOUND')));
    const { clock, notify } = setup(remove);
    clock.fire();
    await vi.waitFor(() => expect(hiddenTasks.get().has('t1')).toBe(false));
    expect(notify).toHaveBeenCalledTimes(1);
  });
});
