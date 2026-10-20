import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

// Per device, not per user: whoever holds this phone has already found the box.
const KEY = 'casa-hint-complete';

type Listener = (seen: boolean) => void;

let seen: boolean | null = null;
let loading: Promise<boolean> | null = null;
const listeners = new Set<Listener>();

/** Whether the «tap the box» hint has done its job on this device. Unreadable = seen (stay quiet). */
export function loadHintSeen(): Promise<boolean> {
  if (seen !== null) return Promise.resolve(seen);
  loading ??= AsyncStorage.getItem(KEY)
    .then((value) => value !== null)
    .catch(() => true)
    .then((value) => {
      // A completion while reading wins over what storage said.
      seen ??= value;
      return seen;
    });
  return loading;
}

/** The first completion, by any route: the hint goes away for good. Never throws. */
export function markHintSeen(): void {
  if (seen === true) return;
  seen = true;
  for (const listener of listeners) listener(true);
  AsyncStorage.setItem(KEY, '1').catch(() => undefined);
}

export function subscribeHint(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True while the hint should show; false while it is still being read. */
export function useCompleteHint(): boolean {
  const [show, setShow] = useState(seen === false);
  useEffect(() => {
    let live = true;
    void loadHintSeen().then((value) => {
      if (live) setShow(!value);
    });
    const stop = subscribeHint((value) => setShow(!value));
    return () => {
      live = false;
      stop();
    };
  }, []);
  return show;
}
