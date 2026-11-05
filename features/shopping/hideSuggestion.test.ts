import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/data/supabase/errors';
import { t } from '@/i18n';
import type { NoticeAction } from '@/ui/components/Notice';
import { hiddenSuggestions, hideSuggestionWithUndo } from './hideSuggestion';

function run(remove: (name: string) => Promise<void>) {
  let fire: () => void = () => undefined;
  const notify = vi.fn<(message: string, action?: NoticeAction) => void>();
  hideSuggestionWithUndo({
    id: 'bolsa aa',
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

// Bloque 15.3 (P3-9): «lo de siempre» had no way to drop a suggestion.
describe('hideSuggestionWithUndo', () => {
  it('drops the suggestion at once and says so with «Deshacer»', () => {
    const { notify } = run(() => Promise.resolve());
    expect(hiddenSuggestions.get().has('bolsa aa')).toBe(true);
    expect(notify.mock.calls[0]![0]).toBe(t('shopping.usualRemoved'));
    expect(notify.mock.calls[0]![1]?.label).toBe(t('tasks.undo'));
  });

  it('hides it on the server when the notice goes', async () => {
    const remove = vi.fn(() => Promise.resolve());
    const { fire } = run(remove);
    fire();
    await vi.waitFor(() => expect(hiddenSuggestions.get().has('bolsa aa')).toBe(false));
    expect(remove).toHaveBeenCalledWith('bolsa aa');
  });

  it('offers it again and says so when hiding fails', async () => {
    const { notify, fire } = run(() => Promise.reject(new AppError('NETWORK')));
    fire();
    await vi.waitFor(() =>
      expect(notify).toHaveBeenLastCalledWith(t('shopping.usualRemoveFailedOffline')),
    );
    expect(hiddenSuggestions.get().has('bolsa aa')).toBe(false);
  });
});
