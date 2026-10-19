import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '@/i18n';
import { useNotice } from '@/ui/components/Notice';
import { noticeDuration } from '@/ui/components/noticeTiming';
import { createDeferredClear, type DeferredClear } from './deferredClear';

/**
 * «Vaciar bolsa» without a dialog: the bought items hide at once, «Bolsa vaciada. Deshacer» shows,
 * and `onCommit` runs when the notice would go (or at once if the screen goes away first).
 */
export function useDeferredClear(onCommit: () => void) {
  const notify = useNotice();
  const latest = useRef(onCommit);
  useEffect(() => {
    latest.current = onCommit;
  }, [onCommit]);
  const [hidden, setHidden] = useState(false);
  const controller = useRef<DeferredClear | null>(null);
  controller.current ??= createDeferredClear({
    commit: () => {
      setHidden(false);
      latest.current();
    },
    schedule: (fn, ms) => {
      const timer = setTimeout(fn, ms);
      return () => clearTimeout(timer);
    },
  });
  useEffect(() => () => controller.current?.flush(), []);

  const clear = useCallback(() => {
    setHidden(true);
    controller.current?.start(noticeDuration({ action: true }));
    notify(t('shopping.cleared'), {
      label: t('shopping.undoClear'),
      testID: 'shopping.clear.undo',
      onPress: () => {
        if (controller.current?.undo()) setHidden(false);
      },
    });
  }, [notify]);

  return { hidden, clear };
}
