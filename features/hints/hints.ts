import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

/**
 * The first-use hints, one per thing the screen does not show: the box (complete), the swipe, the
 * quick add's natural language, the shopping quantity and the door's handle (refresh).
 */
export type HintId = 'complete' | 'swipe' | 'quickAdd' | 'quantity' | 'refresh';

// Per device, not per user: whoever holds this phone has already found it. `casa-hint-complete`
// is the key the box hint has always had.
const keyOf = (id: HintId) => `casa-hint-${id}`;

type Listener = (seen: boolean) => void;

const seen = new Map<HintId, boolean>();
const loading = new Map<HintId, Promise<boolean>>();
const listeners = new Map<HintId, Set<Listener>>();

/** Whether this hint has done its job on this device. Unreadable = seen (stay quiet). */
export function loadHintSeen(id: HintId): Promise<boolean> {
  const known = seen.get(id);
  if (known !== undefined) return Promise.resolve(known);
  let pending = loading.get(id);
  if (pending === undefined) {
    pending = AsyncStorage.getItem(keyOf(id))
      .then((value) => value !== null)
      .catch(() => true)
      .then((value) => {
        // A use while reading wins over what storage said.
        if (!seen.has(id)) seen.set(id, value);
        return seen.get(id) ?? value;
      });
    loading.set(id, pending);
  }
  return pending;
}

/** The first use of what the hint teaches, by any route: it goes away for good. Never throws. */
export function markHintSeen(id: HintId): void {
  if (seen.get(id) === true) return;
  seen.set(id, true);
  for (const listener of listeners.get(id) ?? []) listener(true);
  AsyncStorage.setItem(keyOf(id), '1').catch(() => undefined);
}

export function subscribeHint(id: HintId, listener: Listener): () => void {
  let set = listeners.get(id);
  if (set === undefined) {
    set = new Set();
    listeners.set(id, set);
  }
  set.add(listener);
  return () => set.delete(listener);
}

/** True while the hint should show; false while it is still being read. */
export function useHint(id: HintId): boolean {
  const [show, setShow] = useState(seen.get(id) === false);
  useEffect(() => {
    let live = true;
    void loadHintSeen(id).then((value) => {
      if (live) setShow(!value);
    });
    const stop = subscribeHint(id, (value) => setShow(!value));
    return () => {
      live = false;
      stop();
    };
  }, [id]);
  return show;
}
