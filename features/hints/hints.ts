import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

/**
 * The first-use hints, one per thing the screen does not show: the box (complete), the swipe, the
 * quick add's natural language, the shopping quantity and the door's handle (refresh).
 */
export type HintId = 'complete' | 'swipe' | 'quickAdd' | 'quantity' | 'refresh';

// Per device, not per user: whoever holds this phone has already found it (a decision; the help
// screen can bring them all back). `casa-hint-complete` is the key the box hint has always had.
const keyOf = (id: HintId) => `casa-hint-${id}`;
const ALL: readonly HintId[] = ['complete', 'swipe', 'quickAdd', 'quantity', 'refresh'];

const DAY = 86_400_000;
/** A hint comes back after this long without using what it teaches (fase 10d, decisión de Brad). */
export const HINT_RETURN_DAYS = 30;

/**
 * When the capability was last used, from what storage holds: a date in ms, or null for never.
 * The old mark («1», before the hints came back) has no date and counts from `now`.
 */
export function parseLastUse(value: string | null, now: number): number | null {
  if (value === null) return null;
  const date = Number(value);
  return Number.isFinite(date) && date > 1 ? date : now;
}

/** Whether a hint shows: never used, or not used for `HINT_RETURN_DAYS`. */
export function hintShows(lastUse: number | null, now: number): boolean {
  return lastUse === null || now - lastUse >= HINT_RETURN_DAYS * DAY;
}

type Listener = (seen: boolean) => void;

const seen = new Map<HintId, boolean>();
const lastUses = new Map<HintId, number | null>();
const loading = new Map<HintId, Promise<boolean>>();
const listeners = new Map<HintId, Set<Listener>>();

function tell(id: HintId, value: boolean) {
  for (const listener of listeners.get(id) ?? []) listener(value);
}

/** Whether this hint has done its job on this device for now. Unreadable = seen (stay quiet). */
export function loadHintSeen(id: HintId): Promise<boolean> {
  const known = seen.get(id);
  if (known !== undefined) return Promise.resolve(known);
  let pending = loading.get(id);
  if (pending === undefined) {
    pending = AsyncStorage.getItem(keyOf(id))
      .then((value) => {
        const now = Date.now();
        const lastUse = parseLastUse(value, now);
        // The old dateless mark becomes today's date, so it can come back in a month.
        if (value !== null && String(lastUse) !== value) {
          AsyncStorage.setItem(keyOf(id), String(lastUse)).catch(() => undefined);
        }
        if (!lastUses.has(id)) lastUses.set(id, lastUse);
        return !hintShows(lastUse, now);
      })
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

/**
 * A use of what the hint teaches, by any route: the hint goes, and the date of this use is kept
 * (written at most once a day) so it comes back only after a month without it. Never throws.
 */
export function markHintSeen(id: HintId): void {
  const now = Date.now();
  const last = lastUses.get(id);
  const wasSeen = seen.get(id) === true;
  if (wasSeen && last != null && now - last < DAY) return;
  seen.set(id, true);
  lastUses.set(id, now);
  if (!wasSeen) tell(id, true);
  AsyncStorage.setItem(keyOf(id), String(now)).catch(() => undefined);
}

/** «Volver a ver las pistas» (Cómo funciona Nido): every hint shows again on this device. */
export function resetHints(): void {
  for (const id of ALL) {
    seen.set(id, false);
    lastUses.set(id, null);
    loading.delete(id);
    tell(id, false);
  }
  AsyncStorage.multiRemove(ALL.map(keyOf)).catch(() => undefined);
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
