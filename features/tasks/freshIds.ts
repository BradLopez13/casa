/**
 * Notes that arrived in this session. Only those play the pin choreography: a note mounted on
 * first render, after a filter change or when the list recycles it just appears.
 * `note`: created here (QuickAdd, the new task form). `done`: completed here.
 */
export type FreshKind = 'note' | 'done';

const fresh: Record<FreshKind, Set<string>> = { note: new Set(), done: new Set() };

export function markFresh(id: string, kind: FreshKind = 'note'): void {
  fresh[kind].add(id);
}

/** Whether the note is still waiting for its entrance, without using it up. */
export function isFresh(id: string, kind: FreshKind = 'note'): boolean {
  return fresh[kind].has(id);
}

/** True once per mark: the entrance is played by the first mount only. */
export function takeFresh(id: string, kind: FreshKind = 'note'): boolean {
  return fresh[kind].delete(id);
}
