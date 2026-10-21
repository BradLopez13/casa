import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { t } from '@/i18n';
import { useNotice } from '@/ui/components/Notice';
import { isScreenReaderOn } from '@/ui/a11y';
import { noticeDuration } from '@/ui/components/noticeTiming';
import { createDeferred, type Deferred } from '@/features/undo/deferred';

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
  const controller = useRef<Deferred | null>(null);
  controller.current ??= createDeferred({
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
  // A clear waiting on a screen reader has no timer: leaving the app must not lose it.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') controller.current?.flush();
    });
    return () => sub.remove();
  }, []);

  /** Sends a waiting clear now: something new is going into the bag, and it must not go with it. */
  const settle = useCallback(() => controller.current?.flush(), []);

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

  return { hidden, clear, settle };
}
