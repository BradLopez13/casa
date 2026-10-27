import { useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '@/i18n';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';

type NavigationAction = Parameters<Parameters<typeof usePreventRemove>[1]>[0]['data']['action'];

type Options = {
  dirty: boolean;
  /** Closes the modal; runs when the user cancels a clean form or confirms discarding. */
  onCancel: () => void;
  /** A save or delete in flight (or done) closes the modal itself: never ask then. */
  busy?: boolean;
};

/**
 * Asks before a modal with unsaved edits closes, whether through Cancel or the back gesture.
 * `requestClose` is for the Cancel button; `dialog` must be rendered by the caller.
 */
export function useDiscardGuard({ dirty, onCancel, busy = false }: Options): {
  requestClose: () => void;
  dialog: ReactNode;
} {
  const navigation = useNavigation();
  const [asking, setAsking] = useState(false);
  const [released, setReleased] = useState(false);
  // The prevented back action, replayed once the guard lets go; null means call onCancel.
  const pending = useRef<NavigationAction | null>(null);
  const busyNow = useRef(busy);
  useEffect(() => {
    busyNow.current = busy;
  });

  usePreventRemove(dirty && !released, ({ data }) => {
    pending.current = data.action;
    if (busyNow.current) setReleased(true);
    else setAsking(true);
  });

  // Runs after the render that stopped preventing, so the replayed action goes through.
  useEffect(() => {
    if (!released) return;
    const action = pending.current;
    pending.current = null;
    if (action) navigation.dispatch(action);
    else onCancel();
  }, [released]); // eslint-disable-line react-hooks/exhaustive-deps

  const requestClose = () => {
    if (!dirty || busyNow.current) {
      onCancel();
      return;
    }
    pending.current = null;
    setAsking(true);
  };

  const dialog = (
    <ConfirmDialog
      testID="discard"
      visible={asking}
      title={t('form.discardTitle')}
      message={t('form.discardMessage')}
      confirmLabel={t('form.discard')}
      cancelLabel={t('form.keepEditing')}
      destructive
      onCancel={() => {
        pending.current = null;
        setAsking(false);
      }}
      onConfirm={() => {
        setAsking(false);
        setReleased(true);
      }}
    />
  );

  return { requestClose, dialog };
}
