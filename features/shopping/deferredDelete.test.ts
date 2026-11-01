import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/data/supabase/errors';
import { t } from '@/i18n';
import type { NoticeAction } from '@/ui/components/Notice';
import { deleteItemWithUndo, hiddenItems } from './deferredDelete';

function run(remove: (id: string) => Promise<void>) {
  let fire: () => void = () => undefined;
  const notify = vi.fn<(message: string, action?: NoticeAction) => void>();
  deleteItemWithUndo({
    id: 'p1',
    remove,
    notify,
    ms: 5000,
    schedule: (fn) => {
      fire = fn;
      return () => undefined;
    },
    watchBackground: () => () => undefined,
  });
  return { notify, fire: () => fire() };
}

// Decisión 2 de Brad (27 de octubre, A): borrar un producto, con deshacer y sin diálogo.
describe('deleteItemWithUndo', () => {
  it('hides the product at once and says so with «Deshacer»', () => {
    const { notify } = run(() => Promise.resolve());
    expect(hiddenItems.get().has('p1')).toBe(true);
    expect(notify.mock.calls[0]![0]).toBe(t('shopping.deleted'));
    expect(notify.mock.calls[0]![1]?.leftList).toBe(true);
  });

  it('deletes when the notice goes; one already gone counts as deleted', async () => {
    const remove = vi.fn(() => Promise.reject(new AppError('ITEM_NOT_FOUND')));
    const { notify, fire } = run(remove);
    fire();
    await vi.waitFor(() => expect(hiddenItems.get().has('p1')).toBe(false));
    expect(remove).toHaveBeenCalledWith('p1');
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('puts it back and says so when the delete fails', async () => {
    const { notify, fire } = run(() => Promise.reject(new AppError('NETWORK')));
    fire();
    await vi.waitFor(() =>
      expect(notify).toHaveBeenLastCalledWith(t('shopping.deleteFailedOffline')),
    );
    expect(hiddenItems.get().has('p1')).toBe(false);
  });
});
