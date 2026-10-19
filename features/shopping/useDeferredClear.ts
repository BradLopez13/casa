import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '@/i18n';
import { useNotice } from '@/ui/components/Notice';
import { isScreenReaderOn } from '@/ui/a11y';
import { noticeDuration } from '@/ui/components/noticeTiming';
import { createDeferredClear, type DeferredClear } from './deferredClear';

/**
 * «Vaciar bolsa» without a dialog: the bought items hide at once, «Bolsa vaciada. Deshacer» shows,
 * and `onCommit` runs when the notice goes unused (or at once if the screen goes away first). With
 * a screen reader the notice waits for the person, and so does the clear.
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
    controller.current?.start(noticeDuration({ action: true, screenReader: isScreenReaderOn() }));
    notify(t('shopping.cleared'), {
      label: t('shopping.undoClear'),
      testID: 'shopping.clear.undo',
      onPress: () => {
        if (controller.current?.undo()) setHidden(false);
      },
      onExpire: () => controller.current?.flush(),
    });
  }, [notify]);

  return { hidden, clear };
}
